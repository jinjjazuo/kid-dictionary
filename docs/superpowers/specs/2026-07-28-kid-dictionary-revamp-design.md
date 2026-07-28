# Kids Dictionary — Revamp Design Spec

**Date:** 2026-07-28
**Branch:** `revamp`
**Supersedes:** `2026-04-09-kids-dictionary-design.md`

---

## 1. Overview

A rebuild of the Kids Dictionary app for children aged 4–10. The app looks up a word,
explains it in language a child can understand, and illustrates it with an AI-generated
comic strip. Words the child looks up are collected automatically and reinforced through
a quiz and a crossword.

The core concept is unchanged from the April design. What changes is how users are
identified, where their data lives, which AI providers generate the content, and how the
whole thing looks.

### What changed from the previous build

| Concern | April 2026 design | This revamp |
|---|---|---|
| Accounts | Supabase Auth, sign-in/sign-up pages, protected routes | **None.** Everyone anonymous |
| User's saved words | `user_words` table in Supabase | **localStorage**, behind a `WordStore` interface |
| Saving a word | Manual "Add to My Dictionary" button | **Automatic** on search |
| Removing a word | Not supported | **Quiz-to-delete** — answer correctly to remove |
| Text AI | Claude Haiku | **Configurable** — Gemini or Qwen |
| Image AI | Flux via Replicate | **Configurable** — Gemini by default |
| Comic images | Stored as returned (~1.2 MB PNG) | **WebP-compressed** (~150 KB) |
| Narration | Web Speech API | **Removed** — PRD marks it out of scope |
| Content updates | No mechanism | **Version-gated cache** |
| Visual design | Ad-hoc Tailwind | **Ported design system** from Lovable prototype |
| End-to-end tests | None | **Playwright smoke suite** |

### Why no accounts

The app has no reason to know who a user is. Its value — a good definition and a comic —
is identical for every child. Accounts existed to store a word collection, and localStorage
does that with no signup friction, no password reset flow for a seven-year-old, and no
personal data to protect.

The cost is real and accepted: collections do not sync across devices, and Safari deletes
localStorage for sites unvisited for seven days. Both are solved by adding accounts later,
which the `WordStore` interface is designed to make cheap.

---

## 2. Decision log

Decisions made during design, with the reasoning that produced them. Recorded because the
reasoning is not recoverable from the code.

### 2.1 Two age groups, not three

The PRD proposed three bands (4–6, 7–8, 9–10). We kept two: `'4-6'` and `'7-10'`.

The content difference between a 7-year-old's and a 9-year-old's definition is marginal
compared to the difference between a 5-year-old's and a 9-year-old's. A third band would
increase cache misses by 50% for negligible pedagogical gain — every word would need three
generations instead of two.

### 2.1a Where the age group now lives

The previous design read a child's age group from their `profiles` row. With no accounts,
that table is gone and the setting needs a new home.

It goes in localStorage under `kd.ageGroup.v1`, defaulting to `'4-6'`, with a toggle in the
site header. This is deliberately a lightweight preference rather than an onboarding step —
a child who lands on the app can search immediately, and an adult can change the setting in
one tap if the content reads too young.

Changing it does not alter already-saved words. Each `SavedWord` records the age group it
was generated for, so a collection may legitimately contain entries from both bands. The
dictionary displays all of them without filtering; the setting only affects new lookups.

### 2.2 localStorage for user data, Supabase for the shared cache

These solve different problems and belong in different places.

The word cache is *shared* — one child looking up "dinosaur" should mean every other child
gets it instantly and free. That requires a server-side store, and it is what protects the
AI budget and rate limits.

A child's collection is *private* and needs no server. Putting it in localStorage removes
authentication from the critical path entirely.

### 2.3 Gemini over Claude and Replicate

Gemini's free tier covers the entire MVP at zero cost: roughly 250–1,500 text requests per
day and up to ~500 images per day through AI Studio, with no credit card. Replicate charges
per image with no free tier.

It also collapses two API keys into one and removes a dependency. Gemini's image model
supports character consistency across panels, which Flux handles poorly — the comic gets
better, not worse.

Qwen is supported as an alternative because the user wants provider choice. Both sit behind
interfaces so neither is load-bearing.

**Caveat:** Google's free tier trains on submitted data. The app sends only word prompts and
receives comics — no child's personal information is transmitted. The paid tier opts out.

### 2.4 WebP compression is load-bearing, not an optimisation

Supabase's free tier allows 1 GB of file storage and 5 GB of monthly egress.

| | Raw PNG (~1.2 MB) | WebP q80 (~150 KB) |
|---|---|---|
| Comics fitting in 1 GB | ~830 | **~6,600** |
| First-time views per month in 5 GB | ~4,200 | **~35,000** |

At two age groups per word, raw PNGs fill the free tier at roughly 415 distinct words.
Compression moves that ceiling past 3,000 words. This single step is what makes the free
tier viable, so it is a requirement rather than a nice-to-have.

### 2.5 Denormalised saved words

A saved word stores a full copy of its content in localStorage, not a reference to be
re-fetched.

The failure modes are asymmetric. A stale definition means a child reads slightly older
wording and nobody notices. A network failure with reference-only storage means a child
opens "My Words" and sees an **empty collection** — a small child concluding their work is
gone. Denormalising also means the quiz and crossword read every saved word instantly with
no batch fetch before the game starts.

The staleness cost is mitigated by version stamping (§2.6).

### 2.6 Separate text and image versions

Both the Supabase cache and each saved word carry version numbers, and text and image
versions are independent.

Bumping `textVersion` makes older rows invisible to lookups. They regenerate lazily, one
word at a time, as users search them — no migration script and no bulk regeneration bill.

They are split because regeneration costs differ by orders of magnitude. Text is cheap and
fast; images are rate-limited at ~500/day. A combined version would mean that improving one
word of a definition prompt redraws every comic in the cache, consuming the entire daily
image quota to change text.

Old rows are not deleted on a version bump — they simply stop matching. At ~2 KB per row
this is free. Orphaned comic images do occupy Storage; a cleanup script is future work.

### 2.7 localStorage capacity is not a constraint

A saved word is roughly 1 KB serialised. The browser limit is ~5 MB per origin, giving
roughly 5,000 words. Realistic usage for one child is 100–300 words.

The limit is only reachable by storing image bytes rather than URLs — a base64 comic is
~400 KB in UTF-16, which fills the quota at about 12 words. **Store URLs only.**

---

## 3. Architecture

### 3.1 First lookup of a word — cache miss

```
Child types "dinosaur"
        │
        ▼
  API route: GET /api/word/dinosaur?ageGroup=4-6
        │
        │ 1. Check cache
        ▼
  Supabase `words`
  (dinosaur, 4-6, textVersion=1)
        │
    NOT FOUND
        │
        │ 2. Validate the word is real
        ▼
  dictionaryapi.dev  ──── 404 ───▶  "Hmm, we don't know that word!"
        │                            (stop — no AI calls made)
     real word
        │
        │ 3. Simplify + write examples + write story
        ▼
  TextProvider (Gemini / Qwen)
        │
        │ 4. Draw the comic
        ▼
  ImageProvider (Gemini)  ──▶  PNG ~1.2 MB
        │
        │ 5. Compress
        ▼
  sharp: PNG → WebP q80 ~150 KB
        │
        │ 6. Upload, with Cache-Control: max-age=31536000
        ▼
  Supabase Storage `comics/dinosaur-4-6.webp`
        │
        │ returns public URL
        │
        │ 7. Write the row
        ▼
  Supabase `words` INSERT
        │
        ▼
  Child sees the page      (~10 seconds, happens once ever)
```

### 3.2 Every subsequent lookup — cache hit

```
Child types "dinosaur"  ──▶  API route  ──▶  Supabase `words`  ──▶  FOUND
                                                                      │
                                                                      ▼
                                                            Page renders (~200 ms)
```

Zero AI calls. This path is why the cache exists and why it must never be bypassed.

### 3.3 Auto-save

When a word page finishes loading, its content is written to localStorage through
`WordStore.add()`. The operation is an idempotent upsert keyed on the word, so re-visiting
a word does not duplicate it.

### 3.4 Opening a saved word — where each piece comes from

```
Child taps "dinosaur" in My Words
        │
        ├── 1. WordStore.list() reads localStorage
        │      → word, definition, examples, image URL
        │      → text renders immediately, zero network
        │
        └── 2. <img src="…dinosaur-4-6.webp">
               → browser checks its own HTTP cache
                    ├── present  → renders instantly, no network, no egress
                    └── absent   → downloads 150 KB from Supabase,
                                   keeps it for one year
```

Step 1 is application code. Step 2 is handled entirely by the browser; the application's
only influence is the `Cache-Control` header set at upload time.

### 3.5 Storage layers

| Layer | Holds | Scope | Limit | Interface |
|---|---|---|---|---|
| Supabase `words` | Definitions, examples, stories, image URLs | Shared by all users | 500 MB ≈ 250,000 rows | — |
| Supabase Storage | The WebP comic files | Shared by all users | 1 GB ≈ 6,600 comics | `ImageStore` |
| localStorage | Which words this user saved | One browser, one device | 5 MB ≈ 5,000 words | `WordStore` |
| Browser HTTP cache | Downloaded comic files | One browser, automatic | Managed by browser | none — implicit |

The last row is not application-managed. It is included because it is what makes repeat
comic views cost nothing, and confusing it with localStorage leads to wrong capacity
reasoning.

---

## 4. Interfaces

Four interfaces exist so that each external dependency can be replaced without touching
consuming code. This is the main structural decision in the revamp.

### 4.1 `WordStore` — the user's collection

```ts
// src/lib/store/types.ts

/**
 * A word the user has collected, stored in full rather than by reference.
 *
 * Content is denormalised so the collection renders instantly and survives
 * network failure. `textVersion` records which prompt generation produced
 * this copy, so stale entries can be identified and refreshed later.
 */
export type SavedWord = {
  word: string                    // lowercase; the identity key
  definition: string
  partOfSpeech: string | null
  examples: string[]
  synonyms: string[]
  phonetic: string | null
  comicImageUrl: string | null    // URL only — never image bytes
  ageGroup: AgeGroup
  textVersion: number
  addedAt: string                 // ISO 8601
}

/**
 * Persistence for the user's word collection.
 *
 * Every method is async even though the localStorage implementation is
 * synchronous. This is deliberate: a future SupabaseWordStore will be
 * genuinely async, and matching the signature now means the swap touches
 * one factory function instead of every call site.
 */
export interface WordStore {
  list(): Promise<SavedWord[]>          // newest first
  add(word: SavedWord): Promise<void>   // idempotent upsert on `word`
  remove(word: string): Promise<void>   // no-op if absent
  has(word: string): Promise<boolean>
  clear(): Promise<void>
}
```

**Implementation notes**

- Storage key is `kd.words.v1` — versioned so a future shape change cannot crash
  returning users.
- Corrupt or unparseable JSON degrades to an empty array rather than throwing. A child
  must never see a blank screen because storage was mangled.
- `add()` catches `QuotaExceededError` and surfaces a friendly message. Unreachable at
  realistic sizes, but a crash here would be ugly.
- Identity is the word string, not a UUID. localStorage has no ID generation, and a word
  is naturally unique within one user's collection. The `words.id` from Supabase stays an
  internal cache detail and never reaches the store.
- There is no `update()`. `add()` is an upsert, which removes partial-update semantics.

### 4.2 `ImageStore` — comic file storage

```ts
// src/lib/storage/types.ts

/**
 * Stores generated comic images and returns a publicly readable URL.
 *
 * Exists so the app can move from Supabase Storage to Cloudflare R2 or S3
 * when the 1 GB free tier is exhausted (~6,600 comics away) without touching
 * the generation pipeline.
 */
export interface ImageStore {
  put(key: string, data: Buffer, contentType: string): Promise<string>
}
```

Today: `SupabaseImageStore`. Chosen over R2 or S3 purely because it needs no credit card
and no IAM setup, and the wall is far away.

### 4.3 `TextProvider` and `ImageProvider` — AI

```ts
// src/lib/ai/types.ts

/**
 * Generates the written content for a word: a simplified definition,
 * example sentences, and a scene-by-scene comic script.
 *
 * Returning null rather than throwing is deliberate — every AI step is
 * optional, and a failure must degrade the page rather than break it.
 */
export interface TextProvider {
  enrichWord(
    word: string,
    rawDefinition: string,
    ageGroup: AgeGroup,
  ): Promise<Enrichment | null>

  generateStory(
    word: string,
    ageGroup: AgeGroup,
    sceneCount: number,
  ): Promise<Scene[] | null>
}

/** Draws the multi-panel comic. Returns raw image bytes, uncompressed. */
export interface ImageProvider {
  generateComic(prompt: string): Promise<Buffer | null>
}
```

Adapters: `GeminiTextProvider`, `QwenTextProvider`, `GeminiImageProvider`.
Selected by the `AI_PROVIDER` environment variable.

**Constraint:** no provider SDK may be imported outside its own adapter file. The rest of
the codebase depends on the interface only.

**Recommendation:** default text to the configured provider and images to Gemini. Qwen's
image generation handles multi-panel layout and cross-panel character consistency less
reliably. The interface permits either.

---

## 4.4 Prompts

Prompts live in `src/lib/ai/prompts.ts`, shared by both providers rather than duplicated
per adapter. Gemini and Qwen both accept plain instructions, so per-model divergence is
speculation until it is demonstrated. A single file is also the thing that will actually be
iterated on, and it is what `config.content.textVersion` gates.

Each prompt splits into a constant system portion, which sets the role and the rules, and a
per-call user portion carrying the word.

### 4.4.1 Enrichment

Rewrites the raw dictionary definition and writes example sentences.

**Constraints the prompt must enforce:**

- An explicit vocabulary ceiling. "Use simple words" is too vague to be reliable — the
  instruction is to use only words the target age already knows, and to rephrase rather
  than reach for a harder word.
- One sentence for ages 4–6; up to two for 7–10.
- `config.word.maxExamples` example sentences, each using the target word naturally, drawn
  from a child's own world rather than adult contexts.
- No use of the target word inside its own definition.

### 4.4.2 Story script

Writes the comic script: `sceneCount` scenes, 3 or 5 by age group.

**Constraints:**

- The target word must appear in the scene text. A story that never uses the word teaches
  nothing.
- The scenes must make the meaning inferable from context alone — a child who cannot read
  the definition should still understand the word from the pictures and narration.
- A single recurring character across scenes, so the comic reads as one story.
- Nothing frightening, violent, or unsettling.

### 4.4.3 Image prompt

Assembled from the story script rather than generated by the model. Specifies the panel
count explicitly and describes each panel from its scene text, plus a fixed style clause for
visual consistency across the whole app.

### 4.4.4 Structured output

Both enrichment and story generation must return parseable JSON. This is the main place the
two adapters genuinely differ:

- **Gemini:** set `responseMimeType: 'application/json'` with a response schema
- **Qwen via OpenRouter:** set `response_format: { type: 'json_object' }`

Neither is a guarantee. Both adapters parse defensively and return `null` on malformed
output, which the pipeline treats as a normal degradation (§6).

---

## 4.5 Content safety

A child will eventually search a word like "death", "war", or "gun". These are real words
with legitimate places in a dictionary, and a child asking what one means deserves an
answer.

**The policy: explain the word, skip the comic.**

```
Word looked up
      │
      ▼
Is it on the hard blocklist?        slurs, explicit sexual content
      │
   ┌──┴──┐
  yes    no
   │      │
   ▼      ▼
"Let's   Is it on the sensitive list?    death, war, weapons, illness
 look         │
 up a      ┌──┴──┐
 different yes   no
 word"      │     │
            ▼     ▼
      Definition  Definition
      only,       + examples
      no comic    + comic
```

**Why this split.** The definition is the useful part, and withholding it teaches a child
that some questions are unanswerable. The comic is where it becomes uncomfortable —
an illustrated cartoon about death is a different artefact from a sentence explaining it.
Skipping the illustration removes the problem without removing the answer.

The hard blocklist is checked before any AI call, so blocked words cost nothing and reach
no model.

Both lists live in `src/lib/safety/word-lists.ts` and are configurable. They are deliberately
short: dictionaryapi.dev already filters most gibberish and non-words, and the prompts
themselves instruct gentle, age-appropriate treatment as a second layer.

**Sensitive words are cached like any other**, with `comic_image_url: null`. The absence of
a comic is a property of the word, not a generation failure, and the rendering path for both
is identical.

---

## 5. Data model

```sql
-- Global word cache. No user tables — the app has no accounts.
create table public.words (
  id                uuid primary key default gen_random_uuid(),
  word              text not null,
  age_group         text not null check (age_group in ('4-6', '7-10')),
  definition        text not null,          -- AI-simplified for the age group
  part_of_speech    text,                   -- from dictionaryapi.dev
  examples          jsonb not null default '[]',
  synonyms          jsonb not null default '[]',
  phonetic          text,
  story_script      jsonb not null default '[]',
  comic_image_url   text,                   -- null when image generation failed
  text_version      int  not null default 1,
  image_version     int  not null default 1,
  created_at        timestamptz default now(),
  unique (word, age_group, text_version)
);

create index words_lookup_idx
  on public.words (word, age_group, text_version);

-- Redundant when the project has "Enable automatic RLS" on, but explicit
-- so the migration is correct regardless of project settings.
alter table public.words enable row level security;

-- Public read: comics and definitions are not private.
create policy "Words are publicly readable"
  on public.words for select using (true);

-- Required because the project has "Automatically expose new tables" off.
-- Access is granted deliberately, per table.
grant select on public.words to anon, authenticated;

-- No insert policy and no insert grant for anon. Writes happen only in
-- server-side routes using the service-role key, which bypasses RLS.
-- A browser that could insert rows could poison the shared cache for
-- every user, so read-only is the correct client capability.
```

### Required Supabase project settings

Set under **Settings → API → Security** before running the migration.

| Setting | Value | Reason |
|---|---|---|
| Enable Data API | **On** | The app reads the cache through it |
| Automatically expose new tables | **Off** | A new table would otherwise be world-readable the moment it is created, with no warning. Access is granted explicitly instead. |
| Enable automatic RLS | **On** | New tables get row-level security enabled automatically. Without it, carefully written policies are silently never consulted — the most common Supabase mistake. Enabling RLS with no policies fails closed. |

**Removed from the previous schema:** `profiles`, `user_words`, the `handle_new_user`
trigger, and all auth-related policies.

**Storage:** bucket `comics`, public read. Object key `{word}-{ageGroup}-v{imageVersion}.webp`.
Uploaded with `cacheControl: '31536000'` — comics are immutable once generated, so a
one-year cache is correct rather than aggressive.

**Note on the unique constraint:** it includes `text_version`, so bumping the version
creates a new row alongside the old one rather than conflicting. Old rows become
unreachable but harmless.

---

## 6. Word pipeline

`src/lib/word-pipeline.ts`. Order is fixed and must not be rearranged — each step depends
on the previous one, and the validation step exists specifically to run before anything
billable.

1. **Cache lookup** — `(word, ageGroup, textVersion)`. Hit returns immediately.
2. **Safety check** — blocklisted words stop here, before the cache is even consulted for
   generation. Sensitive words continue but skip step 5 (§4.5).
3. **Validate** via `dictionaryapi.dev`. A 404 stops the pipeline before any AI call,
   which is what prevents gibberish from consuming quota. Yields phonetic spelling,
   part of speech, raw definition, synonyms.
4. **Enrich** — `TextProvider.enrichWord()` produces the simplified definition and
   examples.
5. **Story** — `TextProvider.generateStory()` produces 3 or 5 scenes by age group.
   Skipped for sensitive words.
6. **Image** — `ImageProvider.generateComic()` returns a PNG. Skipped for sensitive words.
7. **Compress** — sharp converts to WebP at the configured quality.
8. **Upload** — `ImageStore.put()` returns the public URL.
9. **Cache** — insert the row with current version numbers.

### Degradation

Each AI step is independently optional. A failure downgrades the result rather than
failing the request.

| Failure | Behaviour |
|---|---|
| Word not in dictionaryapi.dev | Friendly "we don't know that word" message. Nothing cached. |
| Enrichment fails | Show the raw dictionary definition. Do not cache — retry next time. |
| Story fails | Show definition and examples, no comic. Do not cache. |
| Image fails | Cache the row with `comic_image_url: null`. Text still complete. |
| Image URL 404s at render | Hide the image element, render everything else. |

The distinction matters: image failure caches (the text is worth keeping and image
generation is the flaky step), whereas text failure does not (a row with no definition has
no value).

### Rate limiting

Word input is capped at `config.word.maxInputLength` characters. The dictionaryapi.dev
validation is the primary filter against abuse, since it runs before anything billable.

---

## 7. Design system

Ported from the user's Lovable prototype, which established the intended look. Values are
HSL triples consumed as CSS custom properties, matching the existing token structure.

### Colour

| Token | Light | Role |
|---|---|---|
| `--background` | `180 40% 97%` | Page — very pale mint |
| `--foreground` | `220 25% 20%` | Text — soft near-black |
| `--primary` | `174 72% 45%` | Teal — main actions |
| `--secondary` | `35 100% 65%` | Warm orange |
| `--accent` | `330 85% 65%` | Pink |
| `--coral` | `12 100% 68%` | Verbs, destructive actions |
| `--sunshine` | `45 100% 60%` | Highlights, tips |
| `--lavender` | `270 60% 75%` | Adjectives |
| `--mint` | `150 60% 70%` | Success, adverbs |
| `--sky` | `200 90% 70%` | Nouns |
| `--radius` | `1rem` | Generous rounding throughout |

Each accent has a paired `-foreground` for text placed on it. A dark theme is defined in
the prototype and carried over.

### Typography

- **Fredoka** — headings, the word itself, numbers. Rounded and friendly.
- **Nunito** — body text, definitions, UI labels. Highly legible at size.

Loaded via `next/font` rather than the prototype's Google Fonts `@import`, to avoid a
render-blocking request.

### Depth

```css
--shadow-card:     0 8px 30px -8px hsl(220 25% 20% / 0.15);
--shadow-button:   0 4px 12px -2px hsl(174 72% 45% / 0.4);
--shadow-playful:  0 6px 0 hsl(174 72% 35%);   /* solid offset — the signature look */
```

`--shadow-playful` is the distinctive element: a hard offset with no blur, giving buttons a
chunky pressable quality suited to the audience.

### Gradients

```css
--gradient-hero: linear-gradient(135deg, hsl(174 72% 45%), hsl(200 90% 70%));
--gradient-fun:  linear-gradient(135deg, hsl(35 100% 65%), hsl(12 100% 68%));
```

Used for the hero headline (via `background-clip: text`) and accent surfaces.

### Motion

`bounce-soft`, `wiggle`, `float`, `pulse-glow`, `pop` — carried across from the prototype.
Floating background shapes on the landing page, `pop` on results appearing, `wiggle` for
playful emphasis.

All decorative animation must respect `prefers-reduced-motion`. This was absent from the
prototype and is added here.

### Part-of-speech badges

| Part of speech | Colour |
|---|---|
| noun | sky |
| verb | coral |
| adjective | lavender |
| adverb | mint |
| pronoun | sunshine |

### Accessibility

- Minimum 48 px tap targets — small fingers on tablets
- Body text minimum 16 px; definitions larger
- All accent-on-background pairings verified at WCAG AA
- Full keyboard navigation for both games
- Reduced-motion honoured

---

## 8. Pages

All routes are public. No middleware.

| Route | Purpose |
|---|---|
| `/` | Hero, search bar, suggested words, collection stats |
| `/search/[word]` | Definition, pronunciation, examples, synonyms, comic |
| `/dictionary` | Saved words — list or A–Z grouped, practice entry point |
| `/games/quiz` | MCQ quiz over saved words |
| `/games/crossword` | Crossword generated from saved words |

A persistent header carries the app name, a link to the collection, a link to the games,
and the age-group toggle (§2.1a).

### `/` — landing

Floating decorative shapes. Hero headline with gradient text. Search bar with loading
state. Four suggested words when nothing has been searched yet. A stats strip appears once
the collection is non-empty: words learned, and an encouraging status.

### `/search/[word]` — word page

In order: the word in Fredoka with its part-of-speech badge; phonetic spelling; simplified
definition; example sentences; synonyms as tappable links to their own word pages; the
comic strip.

A "Saved to My Words" confirmation appears on auto-save. Comic renders below the text so
the definition is never gated on image loading — PRD principle: *definition first*.

### `/dictionary` — the collection

Two views: recency order, or grouped alphabetically under letter headings. Cards show word,
badge, truncated definition, and a remove button.

Empty state prompts the child to search. Below `config.games.minWordsRequired` words, a tip
explains that more words unlock the games.

**Quiz-to-delete:** removing a word requires answering a question about it correctly. This
prevents accidental loss and turns deletion into a moment of recall. Carried from the
prototype because it is genuinely good design. A cancel option always exists.

### `/games/quiz`

Requires `config.games.minWordsRequired` saved words. Each question randomly picks one of
two modes: definition shown, choose the word; or word shown, choose the meaning.

Wrong answers are drawn from the user's other saved words. At the minimum collection size
of four words, removing the correct answer leaves exactly three others — precisely the
number a four-choice question needs. The quiz therefore never needs a source of words
beyond the user's own collection.

This imposes a config constraint: `mcqChoices` must not exceed `minWordsRequired`, or a
question cannot be built at the minimum. A unit test asserts this.

**Question count** is capped at the size of the collection:

```ts
const questionCount = Math.min(config.games.quizQuestionCount, savedWords.length)
```

Four saved words produce a four-question quiz, each word asked once. Twenty saved words
produce a ten-question quiz drawn randomly from the twenty.

The alternative — repeating words to always reach ten questions — was rejected. With only
four words there are only three possible wrong answers, so a repeated word produces a
literally identical screen with the buttons shuffled. That reads as a bug rather than as
revision. A short quiz that ends deliberately is better than a long one that visibly loops.

Choice order is shuffled per question, so the correct answer does not occupy the same
position each time.

Feedback is animated — success in mint, a gentle shake in coral. Score and encouragement at
the end. Results are not persisted.

**Future work, not built today:** a second round that re-asks only the words answered
incorrectly. Targeted repetition is how vocabulary actually sticks, and it layers on top of
the capped first round without restructuring anything. It is deferred because it carries its
own design questions — whether a corrected answer scores, how many retries are allowed —
and today's scope is already full.

### `/games/crossword`

Generated client-side with `crossword-layout-generator`. Clues are the simplified
definitions. Same minimum-word requirement, with a friendly prompt when unmet.

### 8.1 Both games run entirely in the browser

Saved words live in localStorage, and localStorage is a browser API, so the games read
their source data directly through `WordStore.list()`. There is no API route, no network
request, and no server involvement in generating a quiz or laying out a crossword.

This is what denormalised storage (§2.5) buys: the crossword needs `{ word, definition }`
pairs and the quiz needs the same plus synonyms, and all of it is already present locally.

**Consequence:** the previous build's `GET /api/games/quiz` and `GET /api/games/crossword`
routes are deleted (§11).

**Client-only constraint:** `localStorage` does not exist during server rendering. Both
game pages, and every component reading the store, must be `'use client'` and must render a
loading state until the first read resolves. Reading the store during render on the server
produces a hydration mismatch — the most likely failure mode in this area.

**No exceptions.** An earlier draft proposed a `/api/words/random` route to supply extra
wrong answers for the quiz. It is not needed: four saved words yield exactly three wrong
answers, which is what a four-choice question requires. Both games are fully offline-capable
and the app has no game-related API routes at all.

---

## 9. Configuration

Everything tuneable lives in `src/config.ts`. No literal values elsewhere.

```ts
export const config = {
  ageGroups: {
    young: { label: '4-6' as AgeGroup, sceneCount: 3 },
    older: { label: '7-10' as AgeGroup, sceneCount: 5 },
  },

  /**
   * Bumping a version makes existing cache rows invisible, so content
   * regenerates lazily on next lookup. Text and image are independent so a
   * prompt tweak does not redraw every comic — image generation is the
   * rate-limited operation.
   */
  content: {
    textVersion: 1,
    imageVersion: 1,
  },

  ai: {
    provider: process.env.AI_PROVIDER ?? 'gemini',
    gemini: {
      textModel: 'gemini-2.5-flash',
      imageModel: 'gemini-2.5-flash-image',
    },
    qwen: {
      textModel: 'qwen-plus',
    },
  },

  images: {
    format: 'webp',
    quality: 80,        // ~8x smaller than PNG, no visible difference
    cacheSeconds: 31536000,
  },

  games: {
    minWordsRequired: 4,
    /**
     * Must not exceed minWordsRequired. A question needs mcqChoices - 1 wrong
     * answers, and they come only from the user's other saved words. Raising
     * this above the minimum makes a question unbuildable at the minimum
     * collection size. A unit test asserts the relationship.
     */
    mcqChoices: 4,
    /** An upper bound. The actual count is capped at the collection size. */
    quizQuestionCount: 10,
  },

  word: {
    maxInputLength: 50,
    maxSynonyms: 4,
    maxExamples: 2,
  },

  storage: {
    wordsKey: 'kd.words.v1',
    ageGroupKey: 'kd.ageGroup.v1',
  },

  /** Used when the visitor has not chosen an age group. */
  defaultAgeGroup: '4-6' as AgeGroup,
} as const
```

### Environment variables

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=      # server only — never expose to the browser
AI_PROVIDER=gemini              # gemini | qwen
GOOGLE_AI_API_KEY=
OPENROUTER_API_KEY=             # only when AI_PROVIDER=qwen
```

---

## 10. Testing

Test-driven throughout: the failing test is written first, observed failing, then the
minimum implementation that passes it.

### Unit — Vitest

| Area | Covers |
|---|---|
| `LocalWordStore` | add, list, remove, has, clear; upsert dedupe; newest-first order; corrupt JSON tolerance; quota error handling; empty state |
| Word pipeline | cache hit path; each degradation branch; validation short-circuit before AI |
| Text providers | prompt construction per age group; JSON parse failure returns null; malformed response; response wrapped in prose still parses |
| Content safety | blocklisted word stops before any AI call; sensitive word yields a definition with no comic; ordinary word is unaffected; matching is case-insensitive |
| Image compression | PNG in, WebP out, size reduction |
| Quiz generation | both question modes; wrong answers drawn from the user's other saved words; question count capped at collection size; choice order shuffled; scoring |
| Crossword | layout generation; answer validation |
| Config | version defaults; provider selection |

The store tests are pure and fast — they need only a localStorage mock, no browser — and
everything else depends on the store, so they come first.

### End-to-end — Playwright

Deliberately few. These exist to catch integration breakage that unit tests structurally
cannot see: a page that renders blank, a client/server boundary violation, a hydration
mismatch.

1. Search a word → definition renders → comic appears → word auto-saves
2. Saved word appears on `/dictionary` after a reload — proves localStorage persistence
3. Quiz-to-delete removes a word on a correct answer and keeps it on cancel
4. Games show the minimum-words prompt below the threshold and play above it
5. Unknown word shows the friendly not-found message

External calls are mocked at the network layer so the suite is deterministic and free.

---

## 10.1 Server surface — no BFF

After the revamp the app has exactly one API route:

| Route | Why it cannot run in the browser |
|---|---|
| `GET /api/word/[word]` | Holds the AI provider key and the Supabase service-role key; runs sharp to compress the image |

Everything else — saving, reading the collection, both games — happens in the browser
against localStorage.

A separate backend-for-frontend was considered and rejected. Next.js API routes already
serve that purpose: they exist to do what the browser cannot, and to hand back exactly the
shape the page needs. A distinct BFF process would add a hop (browser → BFF → route →
services), a deployment, and no capability. With one route on the whole server, the app
barely has a backend to front.

---

## 10.2 Build order — the UI must work at every step

Test-driven development on a UI project has a specific failure mode: a full suite of
passing unit tests alongside a blank screen, because nothing was ever opened in a browser.
Unit tests cannot see a hydration mismatch, a missing `'use client'`, a component that
throws during render, or a layout that technically renders but looks wrong.

The build therefore proceeds **vertically**, and every step ends with a working screen.

| Step | Work | Verified by |
|---|---|---|
| 1 | Design tokens, fonts, `Header`, root layout | Browser |
| 2 | Landing page, static | Browser |
| 3 | `WordStore` and `LocalWordStore` | Unit tests — pure logic, no UI |
| 4 | Word page against fixture data | Browser |
| 5 | Real pipeline behind the word page | Browser, with a real lookup |
| 6 | Dictionary page, auto-save, quiz-to-delete | Browser |
| 7 | Quiz | Browser — played through |
| 8 | Crossword | Browser — played through |
| 9 | Playwright smoke suite over the finished flows | Automated |

Two properties of this order matter:

**Steps 1, 2 and 4 need no API keys.** Real UI is visible and reviewable before Supabase or
a provider key exists, which decouples the build from account setup.

**No step is more than one increment from a working screen.** A regression is attributable
to the step that introduced it rather than to an accumulated pile of untested UI.

### Visual verification during the build

Playwright is used throughout implementation, not only for the final suite in §10. After
each UI step it starts the dev server, navigates, captures a screenshot, and reads the
browser console. Console errors and failed renders are caught at the step that caused them.

This is verification, not testing — the screenshots are not assertions and are not committed.
The smoke specs in §10 remain the automated regression suite.

---

## 11. Work to remove

The revamp deletes more than it adds. Listed explicitly so it is not left behind.

| Item | Reason |
|---|---|
| `src/app/auth/**` | No accounts |
| `src/middleware.ts` | No protected routes |
| `src/lib/supabase/client.ts` | No browser-side Supabase usage remains |
| `src/lib/replicate.ts` | Replaced by the provider interface |
| `replicate` dependency | Unused |
| `@anthropic-ai/sdk` dependency | Replaced by the configured provider |
| Web Speech API narration | Out of scope per the PRD |
| `profiles`, `user_words` tables | No accounts |
| `POST /api/word/save`, `GET /api/dictionary` | Saving is local |
| `GET /api/games/quiz`, `GET /api/games/crossword` | Games read localStorage directly (§8.1) |
| `as unknown as` casts in `word-pipeline.ts` | Type-safety debt from the previous build |

---

## 12. Out of scope

- Accounts and cross-device sync — deferred, and the `WordStore` interface is the seam
- Chinese translation — present in the prototype, not wanted here
- Text-to-speech narration — PRD marks it out of scope
- Teacher or parent dashboards
- Spaced repetition, streaks, progress analytics
- Multiplayer
- Offline mode
- Orphaned-image cleanup after a version bump

---

## 13. Known limitations

Stated plainly rather than discovered later.

1. **Safari deletes localStorage after seven days of no visits.** A child who does not open
   the app for a week loses their collection with no recovery. This is Safari's anti-tracking
   policy applied to all sites. The real fix is accounts.
2. **No cross-device sync.** The same child on a tablet and a laptop has two collections.
3. **Free-tier training.** Google's free tier trains on submitted data. Only word prompts
   and comics are sent; no child's information is.
4. **Version bumps orphan comic images.** Storage accumulates unreachable files until a
   cleanup script exists.
5. **First lookup takes around ten seconds.** Inherent to image generation. Mitigated by
   rendering the definition first and the comic when ready.
6. **Rate limits are shared across all users.** One key means heavy traffic could exhaust
   the daily image quota. The cache makes this unlikely, since each word costs one
   generation ever.
