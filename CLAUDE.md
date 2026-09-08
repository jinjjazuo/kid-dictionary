# Kids Dictionary — Project Context

## What this is
A web app for kids aged 4–10 to look up words. Each word gets:
- A simplified kid-friendly definition, pronunciation, examples, synonyms
- An AI-generated comic strip illustrating the meaning (no narration)
- A personal word collection + MCQ quiz and crossword games

## How I want you to work

These preferences override default behaviour. Follow them on every task.

### 1. Test-Driven Development — always
Write the failing test first. Watch it fail. Then write the minimum code to pass it.
Never write implementation code before its test exists.
Unit tests in Vitest, end-to-end smoke tests in Playwright.

### 2. Everything configurable
No magic values anywhere. Model names, scene counts, quiz length, version numbers,
provider selection — all live in `src/config.ts` or environment variables.
If you are about to type a literal number or string that someone might want to change,
it belongs in config instead.

### 3. Least code bloat
Write the smallest thing that solves the problem. Specifically:
- No speculative abstraction — build for today's requirement, not an imagined one
- No wrapper functions that only forward arguments
- No defensive code for conditions that cannot occur
- Delete dead code rather than commenting it out
- Prefer one clear function over three indirection layers
- If a file grows past ~200 lines, it is probably doing too much

### 4. Comprehensive docstrings
Every exported function, type, and module gets a docstring explaining **why**, not just what.
The signature already says what it takes and returns. The docstring says why it exists,
what the non-obvious constraints are, and what will break if you change it.

```ts
/**
 * Converts a Gemini PNG comic into a WebP buffer.
 *
 * WebP at quality 80 is ~8x smaller than the source PNG with no visible
 * difference on a tablet screen. This ratio is what keeps the app inside
 * Supabase Storage's 1 GB free tier — without it we fit ~830 comics
 * instead of ~6,600.
 *
 * @param png Raw PNG bytes as returned by the image provider
 * @returns WebP-encoded bytes ready to upload
 */
```

### 5. Ask before assuming
When a requirement is ambiguous and the readings lead to different work,
ask rather than guess. Routine judgment calls are yours to make.

### 6. Verify UI in a real browser
Unit tests cannot see a hydration mismatch, a missing `'use client'`, a component that
throws during render, or a layout that renders but looks wrong. After any UI change,
open it with Playwright: start the dev server, navigate, screenshot, read the console.

Never claim a screen works without having looked at it.

### 7. Never mention Claude in commit messages
No `Co-Authored-By: Claude` trailer. No "Generated with Claude Code".
No reference to Claude, Anthropic, or AI assistance anywhere in a commit
message or pull request body. Write commits as the author would.

## Tech stack
- **Frontend + Backend:** Next.js 14 App Router (`src/app/`)
- **Word cache DB + image storage:** Supabase (no auth — cache only)
- **User's saved words:** browser localStorage
- **AI text (definitions, stories):** configurable — Gemini or Qwen
- **AI images (comics):** configurable — Gemini by default
- **Image compression:** sharp (PNG → WebP)
- **Styling:** Tailwind CSS + Framer Motion
- **Testing:** Vitest (unit) + Playwright (e2e smoke, and visual checks during development)

### Server surface
There is exactly one API route: `GET /api/word/[word]`. It exists because the browser
cannot hold the AI key or the service-role key and cannot run sharp. Everything else —
saving, reading the collection, both games — runs client-side against localStorage.

Do not add API routes for work the browser can do itself.

## Critical architecture decisions

### No accounts
There is no authentication. Every user is anonymous.
A user's saved words live in their browser's localStorage, behind the `WordStore`
interface in `src/lib/store/`. Auth can be added later by writing a
`SupabaseWordStore` against the same interface — do not add auth logic anywhere else.

### Two storage layers — do not confuse them
| Layer | Holds | Where | Interface |
|---|---|---|---|
| Word cache | Generated definitions, stories, image URLs — shared by all users | Supabase `words` table | — |
| Comic images | The WebP files themselves | Supabase Storage `comics` bucket | `ImageStore` |
| Saved words | Which words *this* user collected | Browser localStorage | `WordStore` |

localStorage stores the comic's **URL**, never the image bytes.
Base64 images would blow the 5 MB localStorage limit at ~12 words.

### Word caching
Every lookup is cached in the `words` table, keyed by
`(word, age_group, text_version, image_version)`.
AI providers are ONLY called when that combination has never been generated.
Never bypass this cache.

### Content versioning
`config.content.textVersion` and `config.content.imageVersion` are separate on purpose.

Bumping `textVersion` makes old rows invisible to lookups, so they regenerate
lazily with the new prompt — one word at a time, as users search them.
No migration script, no bulk regeneration bill.

They are split so that changing a definition prompt does not redraw every comic.
Image regeneration is the expensive, rate-limited operation. Keep them independent.

`SavedWord` in localStorage carries `textVersion` so stale saved copies can be
refreshed from the cache later.

### Age groups
- `'4-6'` = young readers (3 comic panels, simple language)
- `'7-10'` = older readers (5 comic panels, richer language)

With no accounts, the selected age group lives in localStorage under
`config.storage.ageGroupKey`, defaulting to `'4-6'`. A first-time visitor is asked
once, by the onboarding picker below; after that it is a header toggle, so a parent
can change the level for a different reader without clearing browser data.

Changing it does not rewrite saved words. Each `SavedWord` records the age group it was
generated for, so a collection may contain both bands. The dictionary shows all of them;
the setting only affects new lookups.

### First launch
`src/components/onboarding/` runs once per browser, mounted on the home page only:
the age picker, then a three-step tour of the search bar, My Words and the games.

The picker asks "How old are you?" and shows every age from
`ageGroups.young.minAge` to `ageGroups.older.maxAge`, because a five-year-old knows
their age and not which band they read at. `ageGroupForAge()` maps the answer, so
the bands stay an internal detail — which means they must remain adjacent and
gapless, or an age on screen maps nowhere sensible.
`config.storage.onboardingKey` records that it is done — bump that key's version to
replay onboarding for everyone, which is the only way an existing visitor sees a
newly added step.

Tour steps find their targets through `data-tour` attributes in the markup rather
than through refs or class names, so restyling a component cannot silently detach
the step pointing at it. A step whose anchor has gone missing ends the tour instead
of stalling — a dimmed screen with nothing to click is the one state a child cannot
get out of.

E2E specs that drive the home page must call `skipOnboarding()` from `e2e/fixtures`,
or the overlay swallows their clicks. `seedWords()` already does.

### Provider abstraction
AI providers sit behind `TextProvider` and `ImageProvider` interfaces in `src/lib/ai/`.
Selected by the `AI_PROVIDER` env var. Never import a provider SDK outside its own
adapter file — the rest of the codebase talks to the interface only.

### Routes
All public. No middleware, no protected routes.
- `/` — search
- `/search/[word]` — word page
- `/dictionary` — saved words
- `/games/quiz`
- `/games/crossword`

### Server vs browser code
- `localStorage` only exists in the browser. Anything touching `WordStore`
  needs `'use client'` and must handle the initial loading state, or hydration breaks.
- The Supabase service-role key is server-only. Never import it into a client component.

### Content safety
Children look up real words, including hard ones. The policy is **explain the word,
skip the comic**.

- Hard blocklist (slurs, explicit sexual content) — stops before any AI call
- Sensitive list (death, war, weapons, illness) — definition and examples yes, comic no
- Everything else — full experience

Withholding a definition teaches a child that some questions are unanswerable. An
illustrated cartoon about death is a different matter from a sentence explaining it.
Sensitive words cache normally with `comic_image_url: null`.

Lists live in `src/lib/safety/word-lists.ts`. Prompts carry age-appropriate tone
instructions as a second layer.

### Prompts
All prompts live in `src/lib/ai/prompts.ts`, shared by every provider — not duplicated
per adapter. This file is what `config.content.textVersion` gates, so bump that version
whenever you change a prompt in a way that should regenerate cached content.

### Graceful degradation
Every AI step is optional. If the comic fails, the definition still renders.
If the image 404s, hide it and show everything else. A child must never see a blank page.

## Do NOT change without discussion
- The age group labels `'4-6'` and `'7-10'` (used as DB check constraints)
- The `words` table schema (adding columns is fine, changing types is not)
- The word generation pipeline order in `src/lib/word-pipeline.ts`
- The `WordStore` / `ImageStore` / `TextProvider` / `ImageProvider` interfaces —
  they exist to keep swaps cheap; changing them defeats the purpose
