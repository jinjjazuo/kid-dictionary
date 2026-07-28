# Kids Dictionary Revamp Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the Kids Dictionary with no authentication, localStorage-backed word collections, configurable Gemini/Qwen AI providers, and the Lovable design system.

**Architecture:** Next.js 14 App Router with exactly one API route. Every external dependency sits behind an interface (`WordStore`, `ImageStore`, `TextProvider`, `ImageProvider`) so it can be swapped without touching consumers. The user's word collection lives in browser localStorage; a shared Supabase table caches generated content so each word is produced once for all users. Both games run entirely client-side.

**Tech Stack:** Next.js 14, TypeScript, Tailwind CSS, Framer Motion, Supabase (cache only), Google Gemini / Qwen via OpenRouter, sharp, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-07-28-kid-dictionary-revamp-design.md`

## Global Constraints

- **TDD.** Write the failing test, watch it fail, then write the minimum code to pass. Never write implementation before its test.
- **No magic values.** Every tuneable value lives in `src/config.ts` or an environment variable.
- **Minimal code.** No speculative abstraction, no forwarding wrappers, no defensive code for impossible conditions. Delete rather than comment out.
- **Docstrings explain why.** Every exported function, type, and module. The signature says what; the docstring says why it exists and what breaks if changed.
- **Browser verification.** After any UI change, open it with Playwright — navigate, screenshot, read the console. Never claim a screen works without looking at it.
- **No AI attribution in commits.** No `Co-Authored-By: Claude`, no "Generated with Claude Code".
- **Age group labels are exactly** `'4-6'` and `'7-10'` — used as database check constraints.
- **localStorage keys:** `kd.words.v1` and `kd.ageGroup.v1`.
- **Comic object key format:** `{word}-{ageGroup}-v{imageVersion}.webp`
- **Cache-Control on uploads:** `31536000` (one year).
- `mcqChoices` must never exceed `minWordsRequired`.
- The Supabase service-role key is server-only. It must never appear in a client component or a `NEXT_PUBLIC_` variable.

## File Structure

**Created**

| File | Responsibility |
|---|---|
| `src/lib/store/types.ts` | `SavedWord` type and `WordStore` interface |
| `src/lib/store/local-store.ts` | localStorage implementation |
| `src/lib/store/index.ts` | `getWordStore()` factory |
| `src/hooks/useWordStore.ts` | React binding for the store |
| `src/hooks/useAgeGroup.ts` | Age group preference, localStorage-backed |
| `src/lib/storage/types.ts` | `ImageStore` interface |
| `src/lib/storage/supabase-image-store.ts` | Supabase Storage implementation |
| `src/lib/ai/types.ts` | `TextProvider`, `ImageProvider`, `Enrichment` |
| `src/lib/ai/prompts.ts` | All prompts, shared across providers |
| `src/lib/ai/gemini.ts` | Gemini adapter |
| `src/lib/ai/qwen.ts` | Qwen adapter via OpenRouter |
| `src/lib/ai/index.ts` | Provider selection from env |
| `src/lib/safety/word-lists.ts` | Blocklist and sensitive list |
| `src/lib/safety/check.ts` | Safety classification |
| `src/lib/images/compress.ts` | PNG to WebP via sharp |
| `src/components/Header.tsx` | App header with age toggle |
| `src/components/ui/Button.tsx` | Button with the playful shadow variant |
| `src/components/ui/Card.tsx` | Card surface |
| `src/components/ui/Badge.tsx` | Part-of-speech badge |
| `src/components/RemoveWordQuiz.tsx` | Quiz-to-delete flow |
| `playwright.config.ts` | Playwright configuration |
| `supabase/migrations/002_revamp_schema.sql` | New schema |

**Modified**

| File | Change |
|---|---|
| `src/config.ts` | Content versions, provider config, image settings, storage keys |
| `src/types.ts` | Remove `UserWord`, add `PartOfSpeech`, update `WordData` |
| `src/app/globals.css` | Full design token set |
| `tailwind.config.ts` | Token-driven colours, radii, animations |
| `src/app/layout.tsx` | Header, background tokens |
| `src/lib/dictionary-api.ts` | Return part of speech |
| `src/lib/word-pipeline.ts` | Safety step, providers, compression, versions |
| `src/lib/quiz.ts` | Local-only, capped question count |
| `src/lib/supabase/server.ts` | Service-role client, no cookies |
| `vitest.config.ts` | jsdom environment for store tests |
| `.env.example` | New variables |

**Deleted**

`src/app/auth/`, `src/middleware.ts`, `src/lib/supabase/client.ts`, `src/lib/replicate.ts`, `src/app/api/word/save/`, `src/app/api/dictionary/`, `src/app/api/games/`, `src/__tests__/lib/replicate.test.ts`, `src/__tests__/lib/claude.test.ts`, `src/__tests__/api/quiz.test.ts`, `src/lib/claude.ts`

---

## Task 1: Strip the old build and set up tooling

Removes everything the revamp replaces, so later tasks build on a clean base rather than working around dead code.

**Files:**
- Delete: `src/app/auth/`, `src/middleware.ts`, `src/lib/supabase/client.ts`, `src/lib/replicate.ts`, `src/lib/claude.ts`, `src/app/api/word/save/`, `src/app/api/dictionary/`, `src/app/api/games/`, `src/__tests__/lib/replicate.test.ts`, `src/__tests__/lib/claude.test.ts`, `src/__tests__/api/quiz.test.ts`
- Modify: `package.json`, `vitest.config.ts`, `.env.example`
- Create: `playwright.config.ts`

**Interfaces:**
- Consumes: nothing
- Produces: a build that compiles with `npm run build`, `npm test` passing, and `npx playwright test` runnable

- [ ] **Step 1: Delete the removed modules**

```bash
cd "c:/Users/jinji/Documents/vibe projects/kid-dictionary"
rm -rf src/app/auth src/app/api/word/save src/app/api/dictionary src/app/api/games
rm -f src/middleware.ts src/lib/supabase/client.ts src/lib/replicate.ts src/lib/claude.ts
rm -f src/__tests__/lib/replicate.test.ts src/__tests__/lib/claude.test.ts src/__tests__/api/quiz.test.ts
```

- [ ] **Step 2: Remove dead dependencies, add the new ones**

```bash
npm uninstall replicate @anthropic-ai/sdk
npm install @google/generative-ai sharp
npm install -D @playwright/test jsdom @testing-library/react @testing-library/jest-dom
npx playwright install chromium
```

`@google/generative-ai` is Google's official SDK. `sharp` does the WebP compression. `jsdom` and Testing Library let Vitest run the store and component tests, which need a `window` and a `localStorage`.

- [ ] **Step 3: Switch Vitest to jsdom**

`vitest.config.ts` — the store tests need `localStorage`, which does not exist in the `node` environment:

```ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    // jsdom, not node: LocalWordStore and every component test need a
    // window with localStorage. Node has neither.
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    // Playwright specs live in e2e/ and must not be collected by Vitest —
    // they use a different runner and would fail on import.
    exclude: ['**/node_modules/**', '**/e2e/**'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

- [ ] **Step 4: Add the Vitest setup file**

`vitest.setup.ts`:

```ts
import '@testing-library/jest-dom/vitest'

// jsdom clears nothing between tests, so localStorage leaks state across
// them. Clearing here keeps store tests independent of execution order.
beforeEach(() => {
  localStorage.clear()
})
```

- [ ] **Step 5: Add the Playwright config**

`playwright.config.ts`:

```ts
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  // Serial locally: these specs share one dev server and one browser
  // profile, so parallel runs race on localStorage state.
  workers: 1,
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 120_000,
  },
})
```

- [ ] **Step 6: Add test scripts to `package.json`**

Inside `"scripts"`:

```json
"test": "vitest run",
"test:watch": "vitest",
"test:e2e": "playwright test",
"test:e2e:ui": "playwright test --ui"
```

- [ ] **Step 7: Rewrite `.env.example`**

```
# Supabase — cache only, no auth
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
# Server-only. Bypasses row level security. Never expose to the browser.
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Which AI provider to use: gemini | qwen
AI_PROVIDER=gemini

# https://aistudio.google.com/apikey
GOOGLE_AI_API_KEY=your_google_ai_key

# https://openrouter.ai/keys — only needed when AI_PROVIDER=qwen
OPENROUTER_API_KEY=your_openrouter_key
```

- [ ] **Step 8: Verify the build compiles**

Run: `npm run build`
Expected: failures only in files that import the deleted modules — `src/app/page.tsx`, `src/app/dictionary/page.tsx`, `src/app/games/*`, `src/app/search/[word]/page.tsx`, `src/lib/word-pipeline.ts`. These are rewritten in later tasks.

Record which files fail. Do not fix them here.

- [ ] **Step 9: Verify Vitest still runs**

Run: `npm test`
Expected: `src/__tests__/config.test.ts` and `src/__tests__/lib/dictionary-api.test.ts` pass. No suite errors from the jsdom switch.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "chore: remove auth, Replicate and Claude; add Gemini, sharp and Playwright

Deletes the authentication pages, middleware, browser Supabase client, and
the Replicate and Anthropic clients, along with the API routes the revamp
makes unnecessary.

Switches Vitest to jsdom because LocalWordStore and the component tests
need a real localStorage, and adds a Playwright config for browser
verification during the build."
```

---

## Task 2: Config, types and the design tokens

Establishes the values every later task reads, and the visual foundation. Ends with a styled page visible in a browser.

**Files:**
- Modify: `src/config.ts`, `src/types.ts`, `src/app/globals.css`, `tailwind.config.ts`
- Test: `src/__tests__/config.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `config.content.textVersion: number`, `config.content.imageVersion: number`
  - `config.ai.provider: string`, `config.ai.gemini.{textModel,imageModel}`, `config.ai.qwen.textModel`
  - `config.images.{format,quality,cacheSeconds}`
  - `config.storage.{wordsKey,ageGroupKey}`
  - `config.defaultAgeGroup: AgeGroup`
  - `config.games.{minWordsRequired,mcqChoices,quizQuestionCount}`
  - `config.word.{maxInputLength,maxSynonyms,maxExamples}`
  - `getAgeGroupConfig(ageGroup: AgeGroup): { label: AgeGroup, sceneCount: number }`
  - `type AgeGroup = '4-6' | '7-10'`, `type PartOfSpeech`, `type Scene`, `type WordData`, `type QuizQuestion`, `type DictionaryApiResult`

- [ ] **Step 1: Write the failing config test**

Replace `src/__tests__/config.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { config, getAgeGroupConfig } from '@/config'

describe('config', () => {
  it('has two age groups with different scene counts', () => {
    expect(config.ageGroups.young.label).toBe('4-6')
    expect(config.ageGroups.older.label).toBe('7-10')
    expect(config.ageGroups.young.sceneCount).toBe(3)
    expect(config.ageGroups.older.sceneCount).toBe(5)
  })

  it('resolves an age group to its scene count', () => {
    expect(getAgeGroupConfig('4-6').sceneCount).toBe(3)
    expect(getAgeGroupConfig('7-10').sceneCount).toBe(5)
  })

  it('starts both content versions at 1', () => {
    expect(config.content.textVersion).toBe(1)
    expect(config.content.imageVersion).toBe(1)
  })

  it('never asks for more choices than the minimum collection can supply', () => {
    // A question needs mcqChoices - 1 wrong answers, and they come only
    // from the user's other saved words. Exceeding the minimum makes a
    // question unbuildable for a user who just unlocked the games.
    expect(config.games.mcqChoices).toBeLessThanOrEqual(config.games.minWordsRequired)
  })

  it('defaults to the younger age group', () => {
    expect(config.defaultAgeGroup).toBe('4-6')
  })

  it('versions its localStorage keys', () => {
    // Versioned so a future shape change cannot crash returning users.
    expect(config.storage.wordsKey).toBe('kd.words.v1')
    expect(config.storage.ageGroupKey).toBe('kd.ageGroup.v1')
  })

  it('compresses images enough to fit the Supabase free tier', () => {
    expect(config.images.format).toBe('webp')
    expect(config.images.quality).toBeLessThanOrEqual(85)
    expect(config.images.cacheSeconds).toBe(31536000)
  })
})
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npm test -- config`
Expected: FAIL — `config.content` is undefined.

- [ ] **Step 3: Write the config**

Replace `src/config.ts`:

```ts
/**
 * Every tuneable value in the application.
 *
 * Nothing here may be duplicated as a literal elsewhere in the codebase.
 * If you are about to type a number or string someone might want to change,
 * it belongs in this file.
 */

export type AgeGroup = '4-6' | '7-10'

export const config = {
  ageGroups: {
    young: { label: '4-6' as AgeGroup, sceneCount: 3 },
    older: { label: '7-10' as AgeGroup, sceneCount: 5 },
  },

  /** Used when a visitor has not chosen an age group. */
  defaultAgeGroup: '4-6' as AgeGroup,

  /**
   * Bumping a version makes existing cache rows invisible to lookups, so
   * content regenerates lazily on next search — one word at a time, with no
   * migration script and no bulk regeneration bill.
   *
   * Text and image are independent because their costs differ by orders of
   * magnitude. Image generation is rate-limited at roughly 500 per day, so a
   * combined version would mean that fixing one word of a definition prompt
   * redraws every comic in the cache.
   */
  content: {
    textVersion: 1,
    imageVersion: 1,
  },

  ai: {
    /** gemini | qwen — selected by the AI_PROVIDER environment variable. */
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
    format: 'webp' as const,
    /**
     * Quality 80 is roughly an eighth the size of the source PNG with no
     * visible difference on a tablet. That ratio is what keeps the app inside
     * Supabase Storage's 1 GB free tier: ~6,600 comics fit instead of ~830.
     */
    quality: 80,
    /** One year. Comics are immutable once generated. */
    cacheSeconds: 31536000,
  },

  games: {
    minWordsRequired: 4,
    /**
     * Must not exceed minWordsRequired. A question needs mcqChoices - 1 wrong
     * answers and they come only from the user's other saved words, so raising
     * this above the minimum makes a question unbuildable at the minimum
     * collection size.
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
    /** Versioned so a future shape change cannot crash returning users. */
    wordsKey: 'kd.words.v1',
    ageGroupKey: 'kd.ageGroup.v1',
  },
} as const

/**
 * Resolves an age group label to its settings.
 *
 * Anything other than '7-10' resolves to the younger group, so an unknown or
 * corrupted stored value degrades to the safer, simpler content rather than
 * throwing.
 */
export function getAgeGroupConfig(ageGroup: AgeGroup) {
  return ageGroup === '7-10' ? config.ageGroups.older : config.ageGroups.young
}
```

- [ ] **Step 4: Run the test and watch it pass**

Run: `npm test -- config`
Expected: PASS, 7 tests.

- [ ] **Step 5: Rewrite the shared types**

Replace `src/types.ts`:

```ts
import type { AgeGroup } from '@/config'

export type { AgeGroup }

/**
 * Grammatical category from dictionaryapi.dev. Drives the colour of the badge
 * on a word card. Unrecognised values fall back to a neutral badge, so this
 * union does not need to be exhaustive.
 */
export type PartOfSpeech =
  | 'noun' | 'verb' | 'adjective' | 'adverb' | 'pronoun'
  | 'preposition' | 'conjunction' | 'interjection'

/** One panel of the comic: its number and the narration beneath it. */
export type Scene = {
  scene: number
  text: string
}

/** A fully generated word, as returned by the lookup pipeline. */
export type WordData = {
  id: string | null
  word: string
  ageGroup: AgeGroup
  definition: string
  partOfSpeech: string | null
  examples: string[]
  synonyms: string[]
  phonetic: string | null
  storyScript: Scene[]
  comicImageUrl: string | null
  textVersion: number
}

export type QuizMode = 'word-to-meaning' | 'meaning-to-word'

export type QuizQuestion = {
  mode: QuizMode
  /** The word or the definition, depending on mode. */
  prompt: string
  choices: string[]
  answerIndex: number
}

/** Raw data from dictionaryapi.dev, before any AI simplification. */
export type DictionaryApiResult = {
  phonetic: string | null
  partOfSpeech: string | null
  rawDefinition: string
  synonyms: string[]
}
```

`UserWord` is gone — `SavedWord` in `src/lib/store/types.ts` replaces it (Task 3). `pronunciationUrl` is gone with narration.

- [ ] **Step 6: Write the design tokens**

Replace `src/app/globals.css`. Values are ported from the Lovable prototype:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 180 40% 97%;
    --foreground: 220 25% 20%;
    --card: 0 0% 100%;
    --card-foreground: 220 25% 20%;
    --primary: 174 72% 45%;
    --primary-foreground: 0 0% 100%;
    --secondary: 35 100% 65%;
    --secondary-foreground: 35 100% 20%;
    --muted: 180 20% 92%;
    --muted-foreground: 220 15% 45%;
    --accent: 330 85% 65%;
    --accent-foreground: 0 0% 100%;
    --destructive: 0 84% 60%;
    --destructive-foreground: 0 0% 100%;
    --border: 180 20% 88%;
    --input: 180 20% 88%;
    --ring: 174 72% 45%;
    --radius: 1rem;

    --coral: 12 100% 68%;
    --coral-foreground: 0 0% 100%;
    --sunshine: 45 100% 60%;
    --sunshine-foreground: 45 100% 15%;
    --lavender: 270 60% 75%;
    --lavender-foreground: 270 60% 20%;
    --mint: 150 60% 70%;
    --mint-foreground: 150 60% 15%;
    --sky: 200 90% 70%;
    --sky-foreground: 200 90% 15%;

    --gradient-hero: linear-gradient(135deg, hsl(174 72% 45%), hsl(200 90% 70%));
    --gradient-fun: linear-gradient(135deg, hsl(35 100% 65%), hsl(12 100% 68%));

    --shadow-card: 0 8px 30px -8px hsl(220 25% 20% / 0.15);
    --shadow-button: 0 4px 12px -2px hsl(174 72% 45% / 0.4);
    /* Hard offset, no blur. The signature chunky pressable look. */
    --shadow-playful: 0 6px 0 hsl(174 72% 35%);
  }

  * {
    box-sizing: border-box;
    border-color: hsl(var(--border));
  }

  body {
    background-color: hsl(var(--background));
    color: hsl(var(--foreground));
    -webkit-tap-highlight-color: transparent;
  }

  h1, h2, h3, h4, h5, h6 {
    font-family: var(--font-fredoka), sans-serif;
  }
}

@layer utilities {
  .bg-gradient-hero { background-image: var(--gradient-hero); }
  .bg-gradient-fun { background-image: var(--gradient-fun); }
  .shadow-playful { box-shadow: var(--shadow-playful); }
  .shadow-card { box-shadow: var(--shadow-card); }
  .shadow-button { box-shadow: var(--shadow-button); }
  .text-gradient {
    background-image: var(--gradient-hero);
    background-clip: text;
    -webkit-background-clip: text;
    color: transparent;
  }
}

@keyframes bounce-soft {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-8px); }
}
@keyframes wiggle {
  0%, 100% { transform: rotate(-3deg); }
  50% { transform: rotate(3deg); }
}
@keyframes float {
  0%, 100% { transform: translateY(0) rotate(0deg); }
  33% { transform: translateY(-10px) rotate(2deg); }
  66% { transform: translateY(-5px) rotate(-2deg); }
}
@keyframes pop {
  0% { transform: scale(0.8); opacity: 0; }
  50% { transform: scale(1.05); }
  100% { transform: scale(1); opacity: 1; }
}
@keyframes shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-6px); }
  75% { transform: translateX(6px); }
}

.animate-bounce-soft { animation: bounce-soft 2s ease-in-out infinite; }
.animate-wiggle { animation: wiggle 0.5s ease-in-out infinite; }
.animate-float { animation: float 4s ease-in-out infinite; }
.animate-pop { animation: pop 0.3s ease-out forwards; }
.animate-shake { animation: shake 0.4s ease-in-out; }

/*
 * Decorative motion only. A child who is motion-sensitive, or whose device is
 * set to reduce motion, gets a static page with no loss of function.
 */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}

::-webkit-scrollbar { width: 12px; }
::-webkit-scrollbar-track { background: hsl(var(--muted)); border-radius: 10px; }
::-webkit-scrollbar-thumb {
  background: hsl(var(--primary));
  border-radius: 10px;
  border: 3px solid hsl(var(--muted));
}
```

- [ ] **Step 7: Point Tailwind at the tokens**

Replace `tailwind.config.ts`:

```ts
import type { Config } from 'tailwindcss'

/**
 * Colours are CSS custom properties rather than literals so the whole palette
 * can shift in one place, and so a dark theme can be added later by
 * redefining the variables without touching a single component.
 */
const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    container: { center: true, padding: '1rem' },
    extend: {
      fontFamily: {
        fredoka: ['var(--font-fredoka)', 'sans-serif'],
        nunito: ['var(--font-nunito)', 'sans-serif'],
      },
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: { DEFAULT: 'hsl(var(--primary))', foreground: 'hsl(var(--primary-foreground))' },
        secondary: { DEFAULT: 'hsl(var(--secondary))', foreground: 'hsl(var(--secondary-foreground))' },
        muted: { DEFAULT: 'hsl(var(--muted))', foreground: 'hsl(var(--muted-foreground))' },
        accent: { DEFAULT: 'hsl(var(--accent))', foreground: 'hsl(var(--accent-foreground))' },
        destructive: { DEFAULT: 'hsl(var(--destructive))', foreground: 'hsl(var(--destructive-foreground))' },
        card: { DEFAULT: 'hsl(var(--card))', foreground: 'hsl(var(--card-foreground))' },
        coral: { DEFAULT: 'hsl(var(--coral))', foreground: 'hsl(var(--coral-foreground))' },
        sunshine: { DEFAULT: 'hsl(var(--sunshine))', foreground: 'hsl(var(--sunshine-foreground))' },
        lavender: { DEFAULT: 'hsl(var(--lavender))', foreground: 'hsl(var(--lavender-foreground))' },
        mint: { DEFAULT: 'hsl(var(--mint))', foreground: 'hsl(var(--mint-foreground))' },
        sky: { DEFAULT: 'hsl(var(--sky))', foreground: 'hsl(var(--sky-foreground))' },
      },
      borderRadius: {
        sm: 'calc(var(--radius) - 4px)',
        md: 'calc(var(--radius) - 2px)',
        lg: 'var(--radius)',
        xl: 'calc(var(--radius) + 4px)',
        '2xl': 'calc(var(--radius) + 8px)',
        '3xl': 'calc(var(--radius) + 16px)',
      },
    },
  },
  plugins: [],
}

export default config
```

- [ ] **Step 8: Run the full suite**

Run: `npm test`
Expected: config and dictionary-api suites pass.

- [ ] **Step 9: Commit**

```bash
git add src/config.ts src/types.ts src/app/globals.css tailwind.config.ts src/__tests__/config.test.ts
git commit -m "feat: add content versioning, provider config and design tokens

Adds separate text and image content versions so a prompt change does not
redraw every cached comic, plus provider selection, image compression
settings and localStorage keys.

Ports the design tokens from the prototype as CSS custom properties, so
the palette lives in one place and a dark theme can be added later without
touching components. Adds a reduced-motion rule the prototype lacked."
```

---

## Task 3: WordStore

Pure logic, no UI, no network. Everything user-facing depends on it, so it comes before any page that reads a collection.

**Files:**
- Create: `src/lib/store/types.ts`, `src/lib/store/local-store.ts`, `src/lib/store/index.ts`
- Test: `src/__tests__/lib/store/local-store.test.ts`

**Interfaces:**
- Consumes: `config.storage.wordsKey`, `type AgeGroup`
- Produces:
  - `type SavedWord = { word, definition, partOfSpeech, examples, synonyms, phonetic, comicImageUrl, ageGroup, textVersion, addedAt }`
  - `interface WordStore { list(): Promise<SavedWord[]>; add(w: SavedWord): Promise<void>; remove(word: string): Promise<void>; has(word: string): Promise<boolean>; clear(): Promise<void> }`
  - `class LocalWordStore implements WordStore`
  - `getWordStore(): WordStore`

- [ ] **Step 1: Write the failing tests**

`src/__tests__/lib/store/local-store.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { LocalWordStore } from '@/lib/store/local-store'
import type { SavedWord } from '@/lib/store/types'
import { config } from '@/config'

function makeWord(word: string, overrides: Partial<SavedWord> = {}): SavedWord {
  return {
    word,
    definition: `Definition of ${word}`,
    partOfSpeech: 'noun',
    examples: [`An example with ${word}.`],
    synonyms: [],
    phonetic: null,
    comicImageUrl: null,
    ageGroup: '4-6',
    textVersion: 1,
    addedAt: new Date().toISOString(),
    ...overrides,
  }
}

describe('LocalWordStore', () => {
  it('starts empty', async () => {
    const store = new LocalWordStore()
    expect(await store.list()).toEqual([])
  })

  it('adds a word and reads it back', async () => {
    const store = new LocalWordStore()
    await store.add(makeWord('dinosaur'))
    const words = await store.list()
    expect(words).toHaveLength(1)
    expect(words[0].word).toBe('dinosaur')
  })

  it('returns newest first', async () => {
    const store = new LocalWordStore()
    await store.add(makeWord('first'))
    await store.add(makeWord('second'))
    await store.add(makeWord('third'))
    expect((await store.list()).map(w => w.word)).toEqual(['third', 'second', 'first'])
  })

  it('upserts rather than duplicating', async () => {
    // Re-visiting a word page must not add it twice. add() is the only
    // write method, so it has to be idempotent on the word.
    const store = new LocalWordStore()
    await store.add(makeWord('dinosaur', { definition: 'Old text' }))
    await store.add(makeWord('dinosaur', { definition: 'New text' }))
    const words = await store.list()
    expect(words).toHaveLength(1)
    expect(words[0].definition).toBe('New text')
  })

  it('moves an upserted word to the front', async () => {
    const store = new LocalWordStore()
    await store.add(makeWord('first'))
    await store.add(makeWord('second'))
    await store.add(makeWord('first'))
    expect((await store.list()).map(w => w.word)).toEqual(['first', 'second'])
  })

  it('removes a word', async () => {
    const store = new LocalWordStore()
    await store.add(makeWord('dinosaur'))
    await store.add(makeWord('rainbow'))
    await store.remove('dinosaur')
    expect((await store.list()).map(w => w.word)).toEqual(['rainbow'])
  })

  it('ignores removal of a word it does not have', async () => {
    const store = new LocalWordStore()
    await store.add(makeWord('dinosaur'))
    await expect(store.remove('nothing')).resolves.toBeUndefined()
    expect(await store.list()).toHaveLength(1)
  })

  it('reports whether it holds a word', async () => {
    const store = new LocalWordStore()
    await store.add(makeWord('dinosaur'))
    expect(await store.has('dinosaur')).toBe(true)
    expect(await store.has('rainbow')).toBe(false)
  })

  it('matches words case-insensitively', async () => {
    // A child typing "Dinosaur" must not create a second entry.
    const store = new LocalWordStore()
    await store.add(makeWord('dinosaur'))
    expect(await store.has('DINOSAUR')).toBe(true)
    await store.remove('Dinosaur')
    expect(await store.list()).toHaveLength(0)
  })

  it('clears everything', async () => {
    const store = new LocalWordStore()
    await store.add(makeWord('dinosaur'))
    await store.add(makeWord('rainbow'))
    await store.clear()
    expect(await store.list()).toEqual([])
  })

  it('treats corrupt storage as empty rather than throwing', async () => {
    // A child must never see a blank screen because localStorage was
    // mangled by another tab, an extension, or a half-finished write.
    localStorage.setItem(config.storage.wordsKey, 'not valid json{{{')
    const store = new LocalWordStore()
    expect(await store.list()).toEqual([])
  })

  it('treats a non-array payload as empty', async () => {
    localStorage.setItem(config.storage.wordsKey, '{"not":"an array"}')
    const store = new LocalWordStore()
    expect(await store.list()).toEqual([])
  })

  it('recovers from corrupt storage on the next write', async () => {
    localStorage.setItem(config.storage.wordsKey, 'garbage')
    const store = new LocalWordStore()
    await store.add(makeWord('dinosaur'))
    expect((await store.list()).map(w => w.word)).toEqual(['dinosaur'])
  })
})
```

- [ ] **Step 2: Run and watch it fail**

Run: `npm test -- local-store`
Expected: FAIL — cannot resolve `@/lib/store/local-store`.

- [ ] **Step 3: Write the types**

`src/lib/store/types.ts`:

```ts
import type { AgeGroup } from '@/config'

/**
 * A word the user has collected.
 *
 * Content is stored in full rather than by reference so the collection renders
 * instantly and survives network failure. The failure modes are asymmetric: a
 * stale definition means slightly older wording nobody notices, whereas a
 * failed fetch with reference-only storage means a child opens their
 * collection and finds it empty.
 *
 * `textVersion` records which generation of prompts produced this copy, so
 * stale entries can be identified and refreshed later without regenerating
 * everything blindly.
 *
 * `comicImageUrl` is a URL, never image bytes. A base64 comic is roughly
 * 400 KB in UTF-16, which fills the 5 MB localStorage quota at about twelve
 * words.
 */
export type SavedWord = {
  /** Lowercase. The identity key — there is no separate id. */
  word: string
  definition: string
  partOfSpeech: string | null
  examples: string[]
  synonyms: string[]
  phonetic: string | null
  comicImageUrl: string | null
  ageGroup: AgeGroup
  textVersion: number
  /** ISO 8601. */
  addedAt: string
}

/**
 * Persistence for the user's word collection.
 *
 * Every method is async even though the localStorage implementation is
 * synchronous. This is deliberate: a future SupabaseWordStore will be
 * genuinely async, and matching that signature now means adding accounts
 * changes one factory function instead of every call site.
 *
 * There is no update() — add() is an upsert keyed on the word, which removes
 * partial-update semantics entirely.
 */
export interface WordStore {
  /** Newest first. */
  list(): Promise<SavedWord[]>
  /** Idempotent upsert on `word`. Moves an existing word to the front. */
  add(word: SavedWord): Promise<void>
  /** No-op when the word is absent. */
  remove(word: string): Promise<void>
  has(word: string): Promise<boolean>
  clear(): Promise<void>
}
```

- [ ] **Step 4: Write the implementation**

`src/lib/store/local-store.ts`:

```ts
import { config } from '@/config'
import type { SavedWord, WordStore } from './types'

/**
 * Stores the user's collection in browser localStorage.
 *
 * The whole collection lives under one key as a single JSON array. That keeps
 * reads and writes to one operation each, at the cost of rewriting the array
 * on every change — acceptable at roughly 1 KB per word and a realistic
 * ceiling of a few hundred words.
 *
 * Only usable in the browser. localStorage does not exist during server
 * rendering, so every consumer must be a client component.
 */
export class LocalWordStore implements WordStore {
  private read(): SavedWord[] {
    const raw = localStorage.getItem(config.storage.wordsKey)
    if (!raw) return []
    try {
      const parsed = JSON.parse(raw)
      // A non-array payload means something else wrote to our key. Treating
      // it as empty is better than throwing on every render.
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }

  private write(words: SavedWord[]): void {
    try {
      localStorage.setItem(config.storage.wordsKey, JSON.stringify(words))
    } catch {
      // QuotaExceededError, or storage disabled entirely in private browsing.
      // Unreachable at realistic collection sizes, but a thrown error here
      // would crash the page mid-render for a child.
    }
  }

  async list(): Promise<SavedWord[]> {
    return this.read()
  }

  async add(word: SavedWord): Promise<void> {
    const key = word.word.toLowerCase()
    const existing = this.read().filter(w => w.word.toLowerCase() !== key)
    this.write([{ ...word, word: key }, ...existing])
  }

  async remove(word: string): Promise<void> {
    const key = word.toLowerCase()
    this.write(this.read().filter(w => w.word.toLowerCase() !== key))
  }

  async has(word: string): Promise<boolean> {
    const key = word.toLowerCase()
    return this.read().some(w => w.word.toLowerCase() === key)
  }

  async clear(): Promise<void> {
    localStorage.removeItem(config.storage.wordsKey)
  }
}
```

- [ ] **Step 5: Write the factory**

`src/lib/store/index.ts`:

```ts
import { LocalWordStore } from './local-store'
import type { WordStore } from './types'

export type { SavedWord, WordStore } from './types'
export { LocalWordStore } from './local-store'

/**
 * Returns the active word store.
 *
 * This function is the entire seam for adding accounts later. It becomes
 * `user ? new SupabaseWordStore(user.id) : new LocalWordStore()`, and nothing
 * that consumes a WordStore has to change.
 */
export function getWordStore(): WordStore {
  return new LocalWordStore()
}
```

- [ ] **Step 6: Run the tests and watch them pass**

Run: `npm test -- local-store`
Expected: PASS, 13 tests.

- [ ] **Step 7: Commit**

```bash
git add src/lib/store src/__tests__/lib/store
git commit -m "feat: add WordStore with a localStorage implementation

The user's collection lives in localStorage behind an interface, so adding
accounts later means writing a SupabaseWordStore and changing one factory
function rather than every call site. Methods are async for the same
reason, even though localStorage is synchronous.

Corrupt or non-array payloads degrade to an empty collection instead of
throwing, and quota errors are swallowed — a storage problem must not
blank the page for a child."
```

---

## Task 4: Hooks, UI primitives and the header

First task with something to look at. Ends with a styled page open in a browser.

**Files:**
- Create: `src/hooks/useWordStore.ts`, `src/hooks/useAgeGroup.ts`, `src/components/ui/Button.tsx`, `src/components/ui/Card.tsx`, `src/components/ui/Badge.tsx`, `src/components/Header.tsx`
- Modify: `src/app/layout.tsx`
- Test: `src/__tests__/hooks/useWordStore.test.tsx`

**Interfaces:**
- Consumes: `getWordStore()`, `SavedWord`, `config.storage.ageGroupKey`, `config.defaultAgeGroup`
- Produces:
  - `useWordStore(): { words: SavedWord[], loading: boolean, addWord(w: SavedWord): Promise<void>, removeWord(word: string): Promise<void>, clearAll(): Promise<void>, hasWord(word: string): boolean }`
  - `useAgeGroup(): { ageGroup: AgeGroup, setAgeGroup(a: AgeGroup): void, loading: boolean }`
  - `<Button variant="playful"|"default"|"outline"|"ghost" size="sm"|"md"|"lg"|"icon">`
  - `<Card>`, `<CardContent>`
  - `<Badge partOfSpeech={string | null}>`
  - `<Header />`

- [ ] **Step 1: Write the failing hook test**

`src/__tests__/hooks/useWordStore.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useWordStore } from '@/hooks/useWordStore'
import type { SavedWord } from '@/lib/store/types'

function makeWord(word: string): SavedWord {
  return {
    word,
    definition: `Definition of ${word}`,
    partOfSpeech: 'noun',
    examples: [],
    synonyms: [],
    phonetic: null,
    comicImageUrl: null,
    ageGroup: '4-6',
    textVersion: 1,
    addedAt: new Date().toISOString(),
  }
}

describe('useWordStore', () => {
  it('starts loading, then settles empty', async () => {
    const { result } = renderHook(() => useWordStore())
    // loading must start true: rendering an empty collection before the
    // first read resolves would flash "no words yet" at a child who has some.
    expect(result.current.loading).toBe(true)
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.words).toEqual([])
  })

  it('adds a word and re-reads', async () => {
    const { result } = renderHook(() => useWordStore())
    await waitFor(() => expect(result.current.loading).toBe(false))
    await act(async () => { await result.current.addWord(makeWord('dinosaur')) })
    expect(result.current.words.map(w => w.word)).toEqual(['dinosaur'])
  })

  it('removes a word', async () => {
    const { result } = renderHook(() => useWordStore())
    await waitFor(() => expect(result.current.loading).toBe(false))
    await act(async () => { await result.current.addWord(makeWord('dinosaur')) })
    await act(async () => { await result.current.removeWord('dinosaur') })
    expect(result.current.words).toEqual([])
  })

  it('clears everything', async () => {
    const { result } = renderHook(() => useWordStore())
    await waitFor(() => expect(result.current.loading).toBe(false))
    await act(async () => { await result.current.addWord(makeWord('a')) })
    await act(async () => { await result.current.addWord(makeWord('b')) })
    await act(async () => { await result.current.clearAll() })
    expect(result.current.words).toEqual([])
  })

  it('reports membership synchronously from loaded state', async () => {
    // Synchronous so a render can ask "is this saved?" without an effect.
    const { result } = renderHook(() => useWordStore())
    await waitFor(() => expect(result.current.loading).toBe(false))
    await act(async () => { await result.current.addWord(makeWord('dinosaur')) })
    expect(result.current.hasWord('DINOSAUR')).toBe(true)
    expect(result.current.hasWord('rainbow')).toBe(false)
  })
})
```

- [ ] **Step 2: Run and watch it fail**

Run: `npm test -- useWordStore`
Expected: FAIL — cannot resolve `@/hooks/useWordStore`.

- [ ] **Step 3: Write the store hook**

`src/hooks/useWordStore.ts`:

```ts
'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { getWordStore } from '@/lib/store'
import type { SavedWord } from '@/lib/store/types'

/**
 * React binding for the user's word collection.
 *
 * `loading` starts true and every consumer must respect it. localStorage does
 * not exist during server rendering, so the first read can only happen in an
 * effect — rendering the empty state before it resolves would flash "no words
 * yet" at a child whose collection is full, and rendering collection content
 * on the server would produce a hydration mismatch.
 *
 * Every mutation re-reads the store rather than patching local state, so the
 * hook cannot drift from what is actually persisted.
 */
export function useWordStore() {
  const store = useMemo(getWordStore, [])
  const [words, setWords] = useState<SavedWord[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setWords(await store.list())
    setLoading(false)
  }, [store])

  useEffect(() => { void refresh() }, [refresh])

  const addWord = useCallback(async (word: SavedWord) => {
    await store.add(word)
    await refresh()
  }, [store, refresh])

  const removeWord = useCallback(async (word: string) => {
    await store.remove(word)
    await refresh()
  }, [store, refresh])

  const clearAll = useCallback(async () => {
    await store.clear()
    await refresh()
  }, [store, refresh])

  /** Synchronous, so a render can ask without an effect. */
  const hasWord = useCallback(
    (word: string) => words.some(w => w.word.toLowerCase() === word.toLowerCase()),
    [words],
  )

  return { words, loading, addWord, removeWord, clearAll, hasWord }
}
```

- [ ] **Step 4: Run the tests and watch them pass**

Run: `npm test -- useWordStore`
Expected: PASS, 5 tests.

- [ ] **Step 5: Write the age group hook**

`src/hooks/useAgeGroup.ts`:

```ts
'use client'

import { useCallback, useEffect, useState } from 'react'
import { config, type AgeGroup } from '@/config'

/**
 * The reading level used for new lookups, persisted in localStorage.
 *
 * A deliberately lightweight preference rather than an onboarding step: a
 * child can search immediately, and an adult can change it in one tap if the
 * content reads too young.
 *
 * Changing it does not rewrite saved words. Each SavedWord records the age
 * group it was generated for, so a collection may legitimately hold both.
 */
export function useAgeGroup() {
  const [ageGroup, setStored] = useState<AgeGroup>(config.defaultAgeGroup)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const raw = localStorage.getItem(config.storage.ageGroupKey)
    // Anything unrecognised degrades to the default rather than being trusted.
    if (raw === '4-6' || raw === '7-10') setStored(raw)
    setLoading(false)
  }, [])

  const setAgeGroup = useCallback((next: AgeGroup) => {
    localStorage.setItem(config.storage.ageGroupKey, next)
    setStored(next)
  }, [])

  return { ageGroup, setAgeGroup, loading }
}
```

- [ ] **Step 6: Write the Button**

`src/components/ui/Button.tsx`:

```tsx
import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Variant = 'playful' | 'default' | 'outline' | 'ghost' | 'destructive'
type Size = 'sm' | 'md' | 'lg' | 'icon'

const VARIANTS: Record<Variant, string> = {
  // The hard offset shadow with no blur is the signature look. active:
  // drops the button into the shadow so it feels physically pressed.
  playful:
    'bg-primary text-primary-foreground shadow-playful hover:brightness-105 ' +
    'active:translate-y-1.5 active:shadow-none',
  default: 'bg-primary text-primary-foreground shadow-button hover:brightness-105',
  outline: 'border-2 border-border bg-card text-foreground hover:border-primary hover:bg-primary/5',
  ghost: 'text-foreground hover:bg-muted',
  destructive: 'bg-destructive text-destructive-foreground hover:brightness-105',
}

const SIZES: Record<Size, string> = {
  // Minimum 48px tall on every non-icon size: small fingers on tablets.
  sm: 'h-12 px-4 text-sm gap-1.5',
  md: 'h-12 px-6 text-base gap-2',
  lg: 'h-14 px-8 text-lg gap-2',
  icon: 'h-12 w-12',
}

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant
  size?: Size
  children?: ReactNode
}

/**
 * The application's only button.
 *
 * Sizes enforce a 48px minimum touch target because the audience is children
 * using tablets, where the default 32px control is unreliable to hit.
 */
export function Button({
  variant = 'default',
  size = 'md',
  className = '',
  children,
  ...props
}: Props) {
  return (
    <button
      className={[
        'inline-flex items-center justify-center rounded-lg font-nunito font-bold',
        'transition-all disabled:opacity-50 disabled:pointer-events-none',
        'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/40',
        VARIANTS[variant],
        SIZES[size],
        className,
      ].join(' ')}
      {...props}
    >
      {children}
    </button>
  )
}
```

- [ ] **Step 7: Write the Card**

`src/components/ui/Card.tsx`:

```tsx
import type { HTMLAttributes, ReactNode } from 'react'

type Props = HTMLAttributes<HTMLDivElement> & { children?: ReactNode }

/** A raised surface. The default container for anything a child reads. */
export function Card({ className = '', children, ...props }: Props) {
  return (
    <div
      className={`rounded-2xl border-2 border-border bg-card shadow-card ${className}`}
      {...props}
    >
      {children}
    </div>
  )
}

export function CardContent({ className = '', children, ...props }: Props) {
  return (
    <div className={`p-6 ${className}`} {...props}>
      {children}
    </div>
  )
}
```

- [ ] **Step 8: Write the Badge**

`src/components/ui/Badge.tsx`:

```tsx
/**
 * Colour-coded grammatical category.
 *
 * Colour is reinforcement, never the only signal — the label is always
 * present, so the badge works for a colour-blind child and in greyscale.
 */
const COLOURS: Record<string, string> = {
  noun: 'bg-sky text-sky-foreground',
  verb: 'bg-coral text-coral-foreground',
  adjective: 'bg-lavender text-lavender-foreground',
  adverb: 'bg-mint text-mint-foreground',
  pronoun: 'bg-sunshine text-sunshine-foreground',
}

export function Badge({
  partOfSpeech,
  className = '',
}: {
  partOfSpeech: string | null
  className?: string
}) {
  if (!partOfSpeech) return null
  // Unrecognised categories still render, in neutral. dictionaryapi.dev
  // returns values beyond the five we colour.
  const colour = COLOURS[partOfSpeech] ?? 'bg-muted text-muted-foreground'
  return (
    <span
      className={`inline-flex items-center rounded-md px-2.5 py-1 text-xs font-bold font-nunito ${colour} ${className}`}
    >
      {partOfSpeech}
    </span>
  )
}
```

- [ ] **Step 9: Write the Header**

`src/components/Header.tsx`:

```tsx
'use client'

import Link from 'next/link'
import { config, type AgeGroup } from '@/config'
import { useAgeGroup } from '@/hooks/useAgeGroup'

const OPTIONS: { label: string; value: AgeGroup }[] = [
  { label: 'Ages 4–6', value: config.ageGroups.young.label },
  { label: 'Ages 7–10', value: config.ageGroups.older.label },
]

/**
 * Persistent navigation and the reading-level toggle.
 *
 * A client component because the toggle reads localStorage. It renders the
 * default age group during the first paint and corrects itself once the
 * stored value loads — the toggle is a preference, not content, so a brief
 * default selection is harmless where a flash of wrong word content would
 * not be.
 */
export function Header() {
  const { ageGroup, setAgeGroup } = useAgeGroup()

  return (
    <header className="border-b-2 border-border bg-card/80 backdrop-blur">
      <div className="container mx-auto flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <Link href="/" className="font-fredoka text-2xl font-bold text-gradient">
          Word World
        </Link>

        <nav className="flex items-center gap-1 font-nunito font-bold">
          <Link href="/dictionary" className="rounded-lg px-3 py-2 hover:bg-muted">
            My Words
          </Link>
          <Link href="/games/quiz" className="rounded-lg px-3 py-2 hover:bg-muted">
            Quiz
          </Link>
          <Link href="/games/crossword" className="rounded-lg px-3 py-2 hover:bg-muted">
            Crossword
          </Link>
        </nav>

        <div
          className="flex items-center gap-1 rounded-lg bg-muted p-1"
          role="radiogroup"
          aria-label="Reading level"
        >
          {OPTIONS.map(option => (
            <button
              key={option.value}
              role="radio"
              aria-checked={ageGroup === option.value}
              onClick={() => setAgeGroup(option.value)}
              className={[
                'rounded-md px-3 py-2 text-sm font-nunito font-bold transition-colors',
                ageGroup === option.value
                  ? 'bg-card text-primary shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              ].join(' ')}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
    </header>
  )
}
```

- [ ] **Step 10: Wire the header into the layout**

Replace `src/app/layout.tsx`:

```tsx
import type { Metadata } from 'next'
import { Fredoka, Nunito } from 'next/font/google'
import { Header } from '@/components/Header'
import './globals.css'

const fredoka = Fredoka({ subsets: ['latin'], variable: '--font-fredoka' })
const nunito = Nunito({ subsets: ['latin'], variable: '--font-nunito' })

export const metadata: Metadata = {
  title: 'Word World — Kids Dictionary',
  description: 'Look up any word and see it come to life in a comic story.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${fredoka.variable} ${nunito.variable} font-nunito min-h-screen`}>
        <Header />
        {children}
      </body>
    </html>
  )
}
```

Background and text colour now come from `globals.css` rather than Tailwind utilities, so the whole palette shifts from one place.

- [ ] **Step 11: Run the suite**

Run: `npm test`
Expected: all suites pass.

- [ ] **Step 12: Look at it in a browser**

```bash
npm run dev
```

Then drive Playwright to `http://localhost:3000`, screenshot, and read the console.

Check: header renders, "Word World" shows the teal-to-sky gradient, the age toggle switches and survives a reload, fonts are Fredoka and Nunito rather than system defaults, **no console errors**, no hydration warning.

The page body will still be the old landing page — that is expected, it is replaced in Task 5.

- [ ] **Step 13: Commit**

```bash
git add src/hooks src/components src/app/layout.tsx src/__tests__/hooks
git commit -m "feat: add store and age-group hooks, UI primitives and header

useWordStore starts in a loading state that every consumer must respect:
localStorage cannot be read during server rendering, so showing the empty
collection before the first read resolves would flash 'no words yet' at a
child whose collection is full.

Buttons enforce a 48px minimum touch target for small fingers on tablets,
and the part-of-speech badge always shows its label so colour is
reinforcement rather than the only signal."
```

---

## Task 5: Content safety

Pure logic, no network. Comes before the providers because the pipeline consults it before spending anything.

**Files:**
- Create: `src/lib/safety/word-lists.ts`, `src/lib/safety/check.ts`
- Test: `src/__tests__/lib/safety.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `type SafetyVerdict = 'allowed' | 'sensitive' | 'blocked'`
  - `checkWord(word: string): SafetyVerdict`

- [ ] **Step 1: Write the failing tests**

`src/__tests__/lib/safety.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { checkWord } from '@/lib/safety/check'

describe('checkWord', () => {
  it('allows an ordinary word', () => {
    expect(checkWord('dinosaur')).toBe('allowed')
    expect(checkWord('rainbow')).toBe('allowed')
  })

  it('marks a difficult but legitimate word as sensitive', () => {
    // A child asking what "death" means deserves an answer. The definition
    // is the useful part; only the illustration is withheld.
    expect(checkWord('death')).toBe('sensitive')
    expect(checkWord('war')).toBe('sensitive')
    expect(checkWord('gun')).toBe('sensitive')
  })

  it('blocks a word that should never reach a model', () => {
    expect(checkWord('porn')).toBe('blocked')
  })

  it('ignores case and surrounding whitespace', () => {
    expect(checkWord('  DEATH  ')).toBe('sensitive')
    expect(checkWord('Porn')).toBe('blocked')
  })

  it('does not match a list entry inside a longer unrelated word', () => {
    // "war" must not make "warm", "reward" or "wardrobe" sensitive.
    expect(checkWord('warm')).toBe('allowed')
    expect(checkWord('reward')).toBe('allowed')
    expect(checkWord('wardrobe')).toBe('allowed')
  })

  it('treats an empty input as allowed', () => {
    // Input validation is the caller's job; this function only classifies.
    expect(checkWord('')).toBe('allowed')
  })
})
```

- [ ] **Step 2: Run and watch it fail**

Run: `npm test -- safety`
Expected: FAIL — cannot resolve `@/lib/safety/check`.

- [ ] **Step 3: Write the word lists**

`src/lib/safety/word-lists.ts`:

```ts
/**
 * Words that must never reach an AI provider.
 *
 * Deliberately short. dictionaryapi.dev already rejects non-words, and the
 * prompts instruct age-appropriate treatment as a second layer, so this list
 * covers only what should not be sent at all.
 *
 * Extend rather than replace — entries are matched whole, never as substrings.
 */
export const BLOCKED_WORDS: readonly string[] = [
  'porn', 'pornography', 'sex', 'rape', 'incest', 'bestiality',
  'nude', 'nudity', 'orgasm', 'masturbate', 'masturbation',
  'whore', 'slut', 'faggot', 'nigger', 'retard',
]

/**
 * Real words with legitimate dictionary entries that should be explained but
 * not illustrated.
 *
 * A sentence explaining what "death" means is useful to a child who asked.
 * An illustrated cartoon about it is a different artefact, and not one this
 * app should generate unsupervised.
 */
export const SENSITIVE_WORDS: readonly string[] = [
  'death', 'die', 'died', 'dead', 'dying', 'kill', 'killed', 'murder',
  'war', 'weapon', 'gun', 'knife', 'bomb', 'bullet', 'shoot',
  'blood', 'wound', 'injury', 'suicide', 'drown',
  'cancer', 'disease', 'illness', 'sick', 'hospital', 'funeral', 'grave',
  'drug', 'drugs', 'alcohol', 'drunk', 'cigarette', 'smoking',
  'abuse', 'violence', 'violent', 'attack', 'fight', 'hurt', 'pain',
  'divorce', 'prison', 'jail', 'crime', 'steal', 'thief',
]
```

- [ ] **Step 4: Write the check**

`src/lib/safety/check.ts`:

```ts
import { BLOCKED_WORDS, SENSITIVE_WORDS } from './word-lists'

/**
 * - `allowed`   — definition, examples and comic
 * - `sensitive` — definition and examples, no comic
 * - `blocked`   — nothing; never sent to a model
 */
export type SafetyVerdict = 'allowed' | 'sensitive' | 'blocked'

/**
 * Classifies a looked-up word.
 *
 * Matching is on the whole normalised word, never a substring: "war" must not
 * make "warm", "reward" or "wardrobe" sensitive, and substring matching on a
 * blocklist produces exactly that class of false positive.
 *
 * Called before the cache is consulted for generation, so a blocked word costs
 * nothing and reaches no provider.
 */
export function checkWord(word: string): SafetyVerdict {
  const normalised = word.trim().toLowerCase()
  if (BLOCKED_WORDS.includes(normalised)) return 'blocked'
  if (SENSITIVE_WORDS.includes(normalised)) return 'sensitive'
  return 'allowed'
}
```

- [ ] **Step 5: Run the tests and watch them pass**

Run: `npm test -- safety`
Expected: PASS, 6 tests.

- [ ] **Step 6: Commit**

```bash
git add src/lib/safety src/__tests__/lib/safety.test.ts
git commit -m "feat: add content safety classification

Three verdicts: blocked words never reach a provider, sensitive words get
a definition but no comic, everything else gets the full experience.

Withholding a definition would teach a child that some questions are
unanswerable, so difficult words are explained. Matching is on the whole
word rather than a substring, or 'war' would make 'warm' and 'reward'
sensitive too."
```

---

## Task 6: Prompts and AI providers

**Files:**
- Create: `src/lib/ai/types.ts`, `src/lib/ai/prompts.ts`, `src/lib/ai/gemini.ts`, `src/lib/ai/qwen.ts`, `src/lib/ai/index.ts`
- Test: `src/__tests__/lib/ai/prompts.test.ts`, `src/__tests__/lib/ai/gemini.test.ts`

**Interfaces:**
- Consumes: `config.ai.*`, `config.word.maxExamples`, `getAgeGroupConfig`, `type Scene`, `type AgeGroup`
- Produces:
  - `type Enrichment = { definition: string, examples: string[] }`
  - `interface TextProvider { enrichWord(word, rawDefinition, ageGroup): Promise<Enrichment | null>; generateStory(word, ageGroup, sceneCount): Promise<Scene[] | null> }`
  - `interface ImageProvider { generateComic(prompt: string): Promise<Buffer | null> }`
  - `enrichSystemPrompt(ageGroup): string`, `enrichUserPrompt(word, rawDefinition, ageGroup): string`
  - `storySystemPrompt(ageGroup): string`, `storyUserPrompt(word, sceneCount): string`
  - `buildImagePrompt(scenes: Scene[]): string`
  - `parseJsonResponse<T>(raw: string): T | null`
  - `getTextProvider(): TextProvider`, `getImageProvider(): ImageProvider`

- [ ] **Step 1: Write the failing prompt tests**

`src/__tests__/lib/ai/prompts.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
  enrichSystemPrompt, enrichUserPrompt,
  storySystemPrompt, storyUserPrompt,
  buildImagePrompt, parseJsonResponse,
} from '@/lib/ai/prompts'
import { config } from '@/config'

describe('enrichment prompts', () => {
  it('states an explicit vocabulary ceiling for young readers', () => {
    // "Use simple words" is too vague to be reliable. The prompt must name
    // the age and forbid reaching for a harder word.
    const prompt = enrichSystemPrompt('4-6')
    expect(prompt).toMatch(/5-year-old|five-year-old/i)
    expect(prompt.toLowerCase()).toContain('only words')
  })

  it('asks older readers for richer language', () => {
    expect(enrichSystemPrompt('7-10')).toMatch(/9-year-old|nine-year-old/i)
  })

  it('forbids defining a word with itself', () => {
    expect(enrichSystemPrompt('4-6').toLowerCase()).toContain('never use the word')
  })

  it('requests the configured number of examples', () => {
    expect(enrichSystemPrompt('4-6')).toContain(String(config.word.maxExamples))
  })

  it('carries the word and the raw definition', () => {
    const prompt = enrichUserPrompt('enormous', 'very large in size', '4-6')
    expect(prompt).toContain('enormous')
    expect(prompt).toContain('very large in size')
  })
})

describe('story prompts', () => {
  it('requires the target word to appear', () => {
    // A story that never uses the word teaches nothing.
    expect(storySystemPrompt('4-6').toLowerCase()).toContain('must use the word')
  })

  it('forbids frightening content', () => {
    expect(storySystemPrompt('4-6').toLowerCase()).toMatch(/nothing (scary|frightening)/)
  })

  it('asks for one recurring character', () => {
    expect(storySystemPrompt('4-6').toLowerCase()).toContain('same character')
  })

  it('carries the word and the scene count', () => {
    const prompt = storyUserPrompt('enormous', 3)
    expect(prompt).toContain('enormous')
    expect(prompt).toContain('3')
  })
})

describe('buildImagePrompt', () => {
  it('states the panel count explicitly', () => {
    // The count must be explicit or the model produces an arbitrary number
    // of panels and the comic no longer matches the script.
    const prompt = buildImagePrompt([
      { scene: 1, text: 'A boy in a garden.' },
      { scene: 2, text: 'He sees an elephant.' },
      { scene: 3, text: 'He laughs.' },
    ])
    expect(prompt).toContain('3')
    expect(prompt).toContain('A boy in a garden.')
    expect(prompt).toContain('He laughs.')
  })

  it('describes every panel in order', () => {
    const prompt = buildImagePrompt([
      { scene: 1, text: 'First.' },
      { scene: 2, text: 'Second.' },
    ])
    expect(prompt.indexOf('First.')).toBeLessThan(prompt.indexOf('Second.'))
  })
})

describe('parseJsonResponse', () => {
  it('parses clean JSON', () => {
    expect(parseJsonResponse<{ a: number }>('{"a":1}')).toEqual({ a: 1 })
  })

  it('parses JSON wrapped in a markdown fence', () => {
    // Models add fences despite being asked for raw JSON.
    expect(parseJsonResponse('```json\n{"a":1}\n```')).toEqual({ a: 1 })
    expect(parseJsonResponse('```\n{"a":1}\n```')).toEqual({ a: 1 })
  })

  it('parses JSON surrounded by prose', () => {
    expect(parseJsonResponse('Here you go: {"a":1} Hope that helps!')).toEqual({ a: 1 })
  })

  it('parses a bare array', () => {
    expect(parseJsonResponse('[{"scene":1,"text":"Hi"}]')).toEqual([{ scene: 1, text: 'Hi' }])
  })

  it('returns null on unparseable output rather than throwing', () => {
    // The pipeline treats null as a normal degradation. A throw here would
    // take down the whole request instead of dropping one optional step.
    expect(parseJsonResponse('not json at all')).toBeNull()
    expect(parseJsonResponse('')).toBeNull()
    expect(parseJsonResponse('{broken')).toBeNull()
  })
})
```

- [ ] **Step 2: Run and watch it fail**

Run: `npm test -- prompts`
Expected: FAIL — cannot resolve `@/lib/ai/prompts`.

- [ ] **Step 3: Write the AI types**

`src/lib/ai/types.ts`:

```ts
import type { AgeGroup, Scene } from '@/types'

/** Age-appropriate definition and examples, replacing the raw dictionary text. */
export type Enrichment = {
  definition: string
  examples: string[]
}

/**
 * Generates the written content for a word.
 *
 * Methods return null rather than throwing. Every AI step is optional and a
 * failure must degrade the page — a child should still get a definition when
 * the story generation fails.
 */
export interface TextProvider {
  enrichWord(word: string, rawDefinition: string, ageGroup: AgeGroup): Promise<Enrichment | null>
  generateStory(word: string, ageGroup: AgeGroup, sceneCount: number): Promise<Scene[] | null>
}

/** Draws the multi-panel comic. Returns raw bytes; compression happens later. */
export interface ImageProvider {
  generateComic(prompt: string): Promise<Buffer | null>
}
```

- [ ] **Step 4: Write the prompts**

`src/lib/ai/prompts.ts`:

```ts
import { config } from '@/config'
import type { AgeGroup, Scene } from '@/types'

/**
 * Every prompt in the application, shared by all providers rather than
 * duplicated per adapter.
 *
 * Gemini and Qwen both accept plain instructions, so per-model divergence is
 * speculation until demonstrated. This file is also what
 * `config.content.textVersion` gates — bump that version whenever a change
 * here should regenerate cached content.
 */

const AGE_DESCRIPTIONS: Record<AgeGroup, string> = {
  '4-6': 'a 5-year-old child who is just learning to read',
  '7-10': 'a 9-year-old child who reads independently',
}

/**
 * Sets the role and the vocabulary ceiling for enrichment.
 *
 * The ceiling is explicit because "use simple words" is not reliable — models
 * routinely reach for a harder word when it is more precise. The instruction
 * is to rephrase instead.
 */
export function enrichSystemPrompt(ageGroup: AgeGroup): string {
  const audience = AGE_DESCRIPTIONS[ageGroup]
  const sentences = ageGroup === '4-6' ? 'exactly one short sentence' : 'one or two sentences'

  return `You write dictionary definitions for ${audience}.

Rules:
- Use only words that ${audience} already knows. If you need a harder word to be precise, rephrase instead — never reach for the harder word.
- Never use the word being defined inside its own definition.
- Write the definition as ${sentences}.
- Write exactly ${config.word.maxExamples} example sentences using the word naturally.
- Set every example in a child's own world: home, school, playground, family, animals, food, weather.
- Keep it warm and plain. No jokes that need adult knowledge.

Respond with JSON only, in this exact shape:
{"definition": "...", "examples": ["...", "..."]}`
}

export function enrichUserPrompt(word: string, rawDefinition: string, ageGroup: AgeGroup): string {
  return `Word: "${word}"
Dictionary definition: "${rawDefinition}"

Rewrite this for ${AGE_DESCRIPTIONS[ageGroup]}.`
}

/**
 * Sets the rules for the comic script.
 *
 * Two constraints carry the pedagogy: the word must appear in the text, and
 * the meaning must be inferable from the scenes alone. A child who cannot
 * read the definition should still understand the word from the pictures.
 */
export function storySystemPrompt(ageGroup: AgeGroup): string {
  const audience = AGE_DESCRIPTIONS[ageGroup]

  return `You write short picture-book stories for ${audience}.

Rules:
- Every scene must use the word naturally in its text. A story that never uses the word teaches nothing.
- The scenes together must make the word's meaning obvious from context alone, without the definition.
- Use the same character in every scene so the panels read as one story.
- One or two short sentences per scene.
- Nothing scary, violent, sad or unsettling. No danger, injury, or characters in distress.
- Describe what can be seen. The scenes become drawings.

Respond with JSON only, in this exact shape:
[{"scene": 1, "text": "..."}, {"scene": 2, "text": "..."}]`
}

export function storyUserPrompt(word: string, sceneCount: number): string {
  return `Write a ${sceneCount}-scene story that teaches the word "${word}".`
}

/**
 * Assembles the image prompt from the script.
 *
 * Built here rather than generated by a model so the style clause and the
 * panel count are identical for every comic in the app. The panel count must
 * be explicit or the model produces an arbitrary number and the picture stops
 * matching the script.
 */
export function buildImagePrompt(scenes: Scene[]): string {
  const panels = scenes
    .map(s => `Panel ${s.scene}: ${s.text}`)
    .join(' ')

  return `A children's comic strip with exactly ${scenes.length} equal-width panels side by side. ` +
    `Flat cartoon illustration, bright cheerful colours, thick clean outlines, simple friendly shapes. ` +
    `The same character appears in every panel. No text, no speech bubbles, no lettering anywhere. ` +
    panels
}

/**
 * Extracts JSON from a model response.
 *
 * Models add markdown fences and conversational padding despite being told to
 * return raw JSON, so this falls back to locating the outermost bracket pair.
 * Returns null rather than throwing — the pipeline treats that as a normal
 * degradation, whereas a throw would fail the whole request.
 */
export function parseJsonResponse<T>(raw: string): T | null {
  if (!raw) return null

  const withoutFence = raw
    .replace(/^\s*```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/, '')
    .trim()

  try {
    return JSON.parse(withoutFence) as T
  } catch {
    // Fall through to bracket extraction.
  }

  const start = withoutFence.search(/[[{]/)
  if (start === -1) return null
  const opener = withoutFence[start]
  const closer = opener === '[' ? ']' : '}'
  const end = withoutFence.lastIndexOf(closer)
  if (end <= start) return null

  try {
    return JSON.parse(withoutFence.slice(start, end + 1)) as T
  } catch {
    return null
  }
}
```

- [ ] **Step 5: Run the prompt tests and watch them pass**

Run: `npm test -- prompts`
Expected: PASS, 16 tests.

- [ ] **Step 6: Write the failing Gemini adapter test**

`src/__tests__/lib/ai/gemini.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGenerateContent = vi.fn()

vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: class {
    getGenerativeModel() {
      return { generateContent: mockGenerateContent }
    }
  },
}))

import { GeminiTextProvider } from '@/lib/ai/gemini'

function textResponse(text: string) {
  return { response: { text: () => text } }
}

describe('GeminiTextProvider.enrichWord', () => {
  beforeEach(() => { mockGenerateContent.mockReset() })

  it('returns the parsed enrichment', async () => {
    mockGenerateContent.mockResolvedValue(
      textResponse('{"definition":"Very big.","examples":["The dog is big.","My bag is big."]}')
    )
    const result = await new GeminiTextProvider('key').enrichWord('enormous', 'very large', '4-6')
    expect(result).toEqual({
      definition: 'Very big.',
      examples: ['The dog is big.', 'My bag is big.'],
    })
  })

  it('returns null on malformed JSON', async () => {
    mockGenerateContent.mockResolvedValue(textResponse('sorry, I cannot do that'))
    expect(await new GeminiTextProvider('key').enrichWord('x', 'y', '4-6')).toBeNull()
  })

  it('returns null when the response is missing a definition', async () => {
    // Parseable but useless. A row with no definition has no value, so the
    // pipeline must treat this as failure rather than cache it.
    mockGenerateContent.mockResolvedValue(textResponse('{"examples":["a"]}'))
    expect(await new GeminiTextProvider('key').enrichWord('x', 'y', '4-6')).toBeNull()
  })

  it('returns null when the API throws', async () => {
    mockGenerateContent.mockRejectedValue(new Error('rate limit'))
    expect(await new GeminiTextProvider('key').enrichWord('x', 'y', '4-6')).toBeNull()
  })
})

describe('GeminiTextProvider.generateStory', () => {
  beforeEach(() => { mockGenerateContent.mockReset() })

  it('returns the parsed scenes', async () => {
    mockGenerateContent.mockResolvedValue(
      textResponse('[{"scene":1,"text":"A."},{"scene":2,"text":"B."},{"scene":3,"text":"C."}]')
    )
    const scenes = await new GeminiTextProvider('key').generateStory('big', '4-6', 3)
    expect(scenes).toHaveLength(3)
    expect(scenes?.[0]).toEqual({ scene: 1, text: 'A.' })
  })

  it('returns null when the model returns the wrong number of scenes', async () => {
    // Panel highlight positioning assumes the script length matches the
    // requested count, so a mismatch is a failure rather than something to
    // silently accept.
    mockGenerateContent.mockResolvedValue(textResponse('[{"scene":1,"text":"Only one."}]'))
    expect(await new GeminiTextProvider('key').generateStory('big', '4-6', 3)).toBeNull()
  })

  it('returns null when the payload is not an array', async () => {
    mockGenerateContent.mockResolvedValue(textResponse('{"scene":1,"text":"A."}'))
    expect(await new GeminiTextProvider('key').generateStory('big', '4-6', 3)).toBeNull()
  })
})
```

- [ ] **Step 7: Run and watch it fail**

Run: `npm test -- gemini`
Expected: FAIL — cannot resolve `@/lib/ai/gemini`.

- [ ] **Step 8: Write the Gemini adapter**

`src/lib/ai/gemini.ts`:

```ts
import { GoogleGenerativeAI } from '@google/generative-ai'
import { config } from '@/config'
import type { AgeGroup, Scene } from '@/types'
import type { Enrichment, ImageProvider, TextProvider } from './types'
import {
  enrichSystemPrompt, enrichUserPrompt,
  storySystemPrompt, storyUserPrompt,
  parseJsonResponse,
} from './prompts'

/**
 * Text generation via Gemini.
 *
 * `responseMimeType: 'application/json'` makes structured output far more
 * reliable but is not a guarantee, so every response still goes through
 * defensive parsing and shape validation.
 */
export class GeminiTextProvider implements TextProvider {
  private client: GoogleGenerativeAI

  constructor(apiKey: string) {
    this.client = new GoogleGenerativeAI(apiKey)
  }

  private async generate(system: string, user: string): Promise<string | null> {
    try {
      const model = this.client.getGenerativeModel({
        model: config.ai.gemini.textModel,
        systemInstruction: system,
        generationConfig: { responseMimeType: 'application/json' },
      })
      const result = await model.generateContent(user)
      return result.response.text()
    } catch {
      // Rate limit, network failure, safety block. All are the same to the
      // caller: this optional step did not produce anything.
      return null
    }
  }

  async enrichWord(
    word: string,
    rawDefinition: string,
    ageGroup: AgeGroup,
  ): Promise<Enrichment | null> {
    const raw = await this.generate(
      enrichSystemPrompt(ageGroup),
      enrichUserPrompt(word, rawDefinition, ageGroup),
    )
    if (!raw) return null

    const parsed = parseJsonResponse<Partial<Enrichment>>(raw)
    // Parseable but missing a definition is still a failure — caching a row
    // with no definition would serve an empty page forever.
    if (!parsed?.definition) return null

    return {
      definition: parsed.definition,
      examples: Array.isArray(parsed.examples)
        ? parsed.examples.slice(0, config.word.maxExamples)
        : [],
    }
  }

  async generateStory(
    word: string,
    ageGroup: AgeGroup,
    sceneCount: number,
  ): Promise<Scene[] | null> {
    const raw = await this.generate(
      storySystemPrompt(ageGroup),
      storyUserPrompt(word, sceneCount),
    )
    if (!raw) return null

    const parsed = parseJsonResponse<Scene[]>(raw)
    if (!Array.isArray(parsed)) return null
    // The panel highlight overlay divides the image into sceneCount equal
    // columns, so a script of a different length would misalign every panel.
    if (parsed.length !== sceneCount) return null
    if (!parsed.every(s => typeof s?.text === 'string' && s.text.length > 0)) return null

    return parsed.map((s, i) => ({ scene: i + 1, text: s.text }))
  }
}

/**
 * Comic generation via Gemini's image model.
 *
 * Returns raw bytes. Compression to WebP happens in the pipeline so the
 * provider stays ignorant of storage concerns.
 */
export class GeminiImageProvider implements ImageProvider {
  private client: GoogleGenerativeAI

  constructor(apiKey: string) {
    this.client = new GoogleGenerativeAI(apiKey)
  }

  async generateComic(prompt: string): Promise<Buffer | null> {
    try {
      const model = this.client.getGenerativeModel({ model: config.ai.gemini.imageModel })
      const result = await model.generateContent(prompt)

      const parts = result.response.candidates?.[0]?.content?.parts ?? []
      for (const part of parts) {
        const data = part.inlineData?.data
        if (data) return Buffer.from(data, 'base64')
      }
      return null
    } catch {
      return null
    }
  }
}
```

- [ ] **Step 9: Run the tests and watch them pass**

Run: `npm test -- gemini`
Expected: PASS, 7 tests.

- [ ] **Step 10: Write the Qwen adapter**

`src/lib/ai/qwen.ts`:

```ts
import { config } from '@/config'
import type { AgeGroup, Scene } from '@/types'
import type { Enrichment, TextProvider } from './types'
import {
  enrichSystemPrompt, enrichUserPrompt,
  storySystemPrompt, storyUserPrompt,
  parseJsonResponse,
} from './prompts'

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'

/**
 * Text generation via Qwen on OpenRouter.
 *
 * Uses the OpenAI-compatible chat completions API directly rather than an SDK
 * — one fetch call is smaller than a dependency. The structured-output
 * parameter differs from Gemini's (`response_format` rather than
 * `responseMimeType`), which is the main reason the adapters are separate.
 *
 * There is no Qwen image provider. Its image generation handles multi-panel
 * layout and cross-panel character consistency less reliably, so comics stay
 * on Gemini regardless of the text provider.
 */
export class QwenTextProvider implements TextProvider {
  constructor(private apiKey: string) {}

  private async generate(system: string, user: string): Promise<string | null> {
    try {
      const res = await fetch(OPENROUTER_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: config.ai.qwen.textModel,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
          response_format: { type: 'json_object' },
        }),
      })
      if (!res.ok) return null
      const data = await res.json()
      return data.choices?.[0]?.message?.content ?? null
    } catch {
      return null
    }
  }

  async enrichWord(
    word: string,
    rawDefinition: string,
    ageGroup: AgeGroup,
  ): Promise<Enrichment | null> {
    const raw = await this.generate(
      enrichSystemPrompt(ageGroup),
      enrichUserPrompt(word, rawDefinition, ageGroup),
    )
    if (!raw) return null

    const parsed = parseJsonResponse<Partial<Enrichment>>(raw)
    if (!parsed?.definition) return null

    return {
      definition: parsed.definition,
      examples: Array.isArray(parsed.examples)
        ? parsed.examples.slice(0, config.word.maxExamples)
        : [],
    }
  }

  async generateStory(
    word: string,
    ageGroup: AgeGroup,
    sceneCount: number,
  ): Promise<Scene[] | null> {
    const raw = await this.generate(
      storySystemPrompt(ageGroup),
      storyUserPrompt(word, sceneCount),
    )
    if (!raw) return null

    // json_object mode forbids a bare array at the top level, so Qwen wraps
    // it. Accept either shape.
    const parsed = parseJsonResponse<Scene[] | { scenes?: Scene[] }>(raw)
    const scenes = Array.isArray(parsed) ? parsed : parsed?.scenes
    if (!Array.isArray(scenes)) return null
    if (scenes.length !== sceneCount) return null
    if (!scenes.every(s => typeof s?.text === 'string' && s.text.length > 0)) return null

    return scenes.map((s, i) => ({ scene: i + 1, text: s.text }))
  }
}
```

- [ ] **Step 11: Write the provider factory**

`src/lib/ai/index.ts`:

```ts
import { config } from '@/config'
import { GeminiImageProvider, GeminiTextProvider } from './gemini'
import { QwenTextProvider } from './qwen'
import type { ImageProvider, TextProvider } from './types'

export type { Enrichment, ImageProvider, TextProvider } from './types'

/**
 * Selects the text provider from the AI_PROVIDER environment variable.
 *
 * Server-only: reads API keys. Throws when the key for the selected provider
 * is missing, because a missing key is a deployment error that should surface
 * loudly at the first request rather than degrading into silent nulls that
 * look like model failures.
 */
export function getTextProvider(): TextProvider {
  if (config.ai.provider === 'qwen') {
    const key = process.env.OPENROUTER_API_KEY
    if (!key) throw new Error('OPENROUTER_API_KEY is not set but AI_PROVIDER=qwen')
    return new QwenTextProvider(key)
  }

  const key = process.env.GOOGLE_AI_API_KEY
  if (!key) throw new Error('GOOGLE_AI_API_KEY is not set')
  return new GeminiTextProvider(key)
}

/**
 * Comics always come from Gemini regardless of the text provider, because
 * Qwen handles multi-panel layout and cross-panel character consistency
 * less reliably.
 */
export function getImageProvider(): ImageProvider {
  const key = process.env.GOOGLE_AI_API_KEY
  if (!key) throw new Error('GOOGLE_AI_API_KEY is not set')
  return new GeminiImageProvider(key)
}
```

- [ ] **Step 12: Run the whole suite**

Run: `npm test`
Expected: all suites pass.

- [ ] **Step 13: Commit**

```bash
git add src/lib/ai src/__tests__/lib/ai
git commit -m "feat: add shared prompts and Gemini/Qwen providers

Prompts live in one file shared by both providers rather than duplicated
per adapter, since both accept plain instructions and this is the file
content versioning gates.

The enrichment prompt names an explicit vocabulary ceiling because 'use
simple words' is not reliable, and the story prompt requires the target
word to appear — a story that never uses the word teaches nothing.

Responses are parsed defensively: models add markdown fences and prose
despite structured-output settings, and a story of the wrong length is
rejected because the panel overlay assumes the script matches the
requested scene count."
```

---

## Task 7: Image compression and storage

**Files:**
- Create: `src/lib/images/compress.ts`, `src/lib/storage/types.ts`, `src/lib/storage/supabase-image-store.ts`, `src/lib/storage/index.ts`
- Modify: `src/lib/supabase/server.ts`
- Test: `src/__tests__/lib/images/compress.test.ts`

**Interfaces:**
- Consumes: `config.images.*`
- Produces:
  - `compressToWebp(png: Buffer): Promise<Buffer>`
  - `comicObjectKey(word: string, ageGroup: AgeGroup, imageVersion: number): string`
  - `interface ImageStore { put(key, data, contentType): Promise<string | null> }`
  - `getImageStore(): ImageStore`
  - `createServiceClient(): SupabaseClient` in `src/lib/supabase/server.ts`

- [ ] **Step 1: Write the failing compression tests**

`src/__tests__/lib/images/compress.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import sharp from 'sharp'
import { compressToWebp, comicObjectKey } from '@/lib/images/compress'

/** A real PNG, so sharp exercises its actual decode path. */
async function makePng(width = 1024, height = 512): Promise<Buffer> {
  return sharp({
    create: {
      width, height, channels: 3,
      background: { r: 255, g: 120, b: 40 },
    },
  }).png().toBuffer()
}

describe('compressToWebp', () => {
  it('produces a WebP', async () => {
    const webp = await compressToWebp(await makePng())
    const meta = await sharp(webp).metadata()
    expect(meta.format).toBe('webp')
  })

  it('produces a smaller file than the source PNG', async () => {
    // The size ratio is what keeps the app inside the Supabase free tier,
    // so it is a requirement rather than an optimisation.
    const png = await makePng()
    const webp = await compressToWebp(png)
    expect(webp.length).toBeLessThan(png.length)
  })

  it('preserves the image dimensions', async () => {
    const webp = await compressToWebp(await makePng(800, 400))
    const meta = await sharp(webp).metadata()
    expect(meta.width).toBe(800)
    expect(meta.height).toBe(400)
  })

  it('rejects input that is not an image', async () => {
    await expect(compressToWebp(Buffer.from('not an image'))).rejects.toThrow()
  })
})

describe('comicObjectKey', () => {
  it('includes the word, age group and image version', () => {
    expect(comicObjectKey('dinosaur', '4-6', 1)).toBe('dinosaur-4-6-v1.webp')
  })

  it('normalises case so one word maps to one object', () => {
    expect(comicObjectKey('Dinosaur', '4-6', 1)).toBe('dinosaur-4-6-v1.webp')
  })

  it('strips characters that are unsafe in an object key', () => {
    // A looked-up word can contain spaces, apostrophes or slashes, all of
    // which break either the key or the public URL.
    expect(comicObjectKey("ice cream", '4-6', 1)).toBe('ice-cream-4-6-v1.webp')
    expect(comicObjectKey("don't", '7-10', 2)).toBe('dont-7-10-v2.webp')
  })

  it('changes when the image version changes', () => {
    // Bumping the version must produce a new object rather than overwriting
    // the old one, since the old row may still be served during rollout.
    expect(comicObjectKey('dinosaur', '4-6', 2)).not.toBe(comicObjectKey('dinosaur', '4-6', 1))
  })
})
```

- [ ] **Step 2: Run and watch it fail**

Run: `npm test -- compress`
Expected: FAIL — cannot resolve `@/lib/images/compress`.

- [ ] **Step 3: Write the compression module**

`src/lib/images/compress.ts`:

```ts
import sharp from 'sharp'
import { config } from '@/config'
import type { AgeGroup } from '@/types'

/**
 * Converts a generated comic PNG into WebP.
 *
 * WebP at the configured quality is roughly an eighth the size of the source
 * PNG with no visible difference on a tablet screen. That ratio is what keeps
 * the app inside Supabase Storage's 1 GB free tier: about 6,600 comics fit
 * instead of about 830. This step is a requirement, not an optimisation.
 *
 * Throws on input that is not a decodable image. The caller treats that as a
 * failed comic and caches the row without one.
 */
export async function compressToWebp(png: Buffer): Promise<Buffer> {
  return sharp(png).webp({ quality: config.images.quality }).toBuffer()
}

/**
 * Builds the storage object key for a comic.
 *
 * The image version is part of the key so bumping it produces a new object
 * rather than overwriting the old one, which may still be served to users
 * holding a cached row during rollout.
 *
 * Words are normalised because a looked-up word can contain spaces,
 * apostrophes or slashes, all of which break either the key or its public URL.
 */
export function comicObjectKey(word: string, ageGroup: AgeGroup, imageVersion: number): string {
  const slug = word
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
  return `${slug}-${ageGroup}-v${imageVersion}.${config.images.format}`
}
```

- [ ] **Step 4: Run the tests and watch them pass**

Run: `npm test -- compress`
Expected: PASS, 8 tests.

- [ ] **Step 5: Replace the Supabase server client**

`src/lib/supabase/server.ts` — the old cookie-based client existed for auth, which is gone:

```ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Supabase client for server-side use.
 *
 * Uses the service-role key, which bypasses row level security. That is
 * required because the browser holds only the anon key and has read-only
 * access — a client that could write to the cache could poison every child's
 * definitions.
 *
 * Never import this into a client component. There is no cookie or session
 * handling because the application has no authentication.
 */
export function createServiceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url) throw new Error('NEXT_PUBLIC_SUPABASE_URL is not set')
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set')

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
```

- [ ] **Step 6: Write the ImageStore interface**

`src/lib/storage/types.ts`:

```ts
/**
 * Stores generated comic images and returns a publicly readable URL.
 *
 * Exists so the application can move from Supabase Storage to Cloudflare R2 or
 * S3 when the 1 GB free tier is exhausted — roughly 6,600 comics away —
 * without touching the generation pipeline.
 *
 * `put` returns null on failure rather than throwing. A comic is optional; a
 * storage outage must not fail the whole word lookup.
 */
export interface ImageStore {
  put(key: string, data: Buffer, contentType: string): Promise<string | null>
}
```

- [ ] **Step 7: Write the Supabase implementation**

`src/lib/storage/supabase-image-store.ts`:

```ts
import { config } from '@/config'
import { createServiceClient } from '@/lib/supabase/server'
import type { ImageStore } from './types'

const BUCKET = 'comics'

/**
 * Stores comics in a public Supabase Storage bucket.
 *
 * Uploads carry a one-year Cache-Control header. Comics are immutable once
 * generated, so browsers keeping them for a year is correct rather than
 * aggressive — and it is what holds monthly egress inside the free tier,
 * since a repeat view then costs nothing.
 */
export class SupabaseImageStore implements ImageStore {
  async put(key: string, data: Buffer, contentType: string): Promise<string | null> {
    try {
      const supabase = createServiceClient()

      const { error } = await supabase.storage.from(BUCKET).upload(key, data, {
        contentType,
        cacheControl: String(config.images.cacheSeconds),
        // Overwrite rather than fail: a retry after a partial write should
        // succeed, and the key already encodes the content version.
        upsert: true,
      })
      if (error) return null

      const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(key)
      return urlData.publicUrl ?? null
    } catch {
      return null
    }
  }
}
```

- [ ] **Step 8: Write the storage factory**

`src/lib/storage/index.ts`:

```ts
import { SupabaseImageStore } from './supabase-image-store'
import type { ImageStore } from './types'

export type { ImageStore } from './types'

/**
 * Returns the active image store.
 *
 * Supabase Storage was chosen over R2 or S3 only because it needs no credit
 * card and no IAM setup, and the 1 GB wall is thousands of comics away.
 * Swapping is a matter of writing another implementation and changing this
 * function.
 */
export function getImageStore(): ImageStore {
  return new SupabaseImageStore()
}
```

- [ ] **Step 9: Write the migration**

`supabase/migrations/002_revamp_schema.sql`:

```sql
-- Revamp schema: no accounts, cache only.
-- The previous schema's profiles and user_words tables are dropped — a user's
-- collection now lives in their browser's localStorage.

drop table if exists public.user_words;
drop table if exists public.profiles cascade;
drop function if exists public.handle_new_user() cascade;
drop table if exists public.words;

create table public.words (
  id                uuid primary key default gen_random_uuid(),
  word              text not null,
  age_group         text not null check (age_group in ('4-6', '7-10')),
  definition        text not null,
  part_of_speech    text,
  examples          jsonb not null default '[]',
  synonyms          jsonb not null default '[]',
  phonetic          text,
  story_script      jsonb not null default '[]',
  comic_image_url   text,
  text_version      int  not null default 1,
  image_version     int  not null default 1,
  created_at        timestamptz default now(),
  -- text_version is part of the key so bumping it creates a new row beside
  -- the old one rather than conflicting. Old rows become unreachable but
  -- harmless at roughly 2 KB each.
  unique (word, age_group, text_version)
);

create index words_lookup_idx on public.words (word, age_group, text_version);

-- Redundant when the project has automatic RLS enabled, but explicit so the
-- migration is correct regardless of project settings.
alter table public.words enable row level security;

-- Definitions and comics are not private.
create policy "Words are publicly readable"
  on public.words for select using (true);

-- Required because the project has "automatically expose new tables" off.
grant select on public.words to anon, authenticated;

-- No insert, update or delete grant for anon. Writes happen only in
-- server-side routes using the service-role key, which bypasses RLS. A
-- browser that could write would be able to poison the shared cache for
-- every user.
```

- [ ] **Step 10: Run the migration**

In the Supabase dashboard: **SQL Editor → New query**, paste the file contents, **Run**.

Expected: "Success. No rows returned."

Then confirm in **Table Editor** that `words` exists with `text_version` and `image_version`, and that `profiles` and `user_words` are gone.

- [ ] **Step 11: Run the suite**

Run: `npm test`
Expected: all suites pass.

- [ ] **Step 12: Commit**

```bash
git add src/lib/images src/lib/storage src/lib/supabase/server.ts supabase/migrations/002_revamp_schema.sql src/__tests__/lib/images
git commit -m "feat: add WebP compression, image storage and the revamp schema

Compression is a requirement rather than an optimisation: WebP at quality
80 is roughly an eighth the size of the source PNG, which is the
difference between ~830 and ~6,600 comics fitting in the Supabase free
tier.

The server Supabase client now uses the service-role key and drops cookie
handling entirely, since there is no authentication. The browser holds
only the anon key and has read-only access — a client that could write
could poison the shared cache for every child.

Schema drops profiles and user_words, and keys rows on
(word, age_group, text_version) so a version bump creates a new row rather
than conflicting with the old one."
```

---

## Task 8: The word pipeline and its API route

The only server-side work in the application.

**Files:**
- Modify: `src/lib/dictionary-api.ts`, `src/lib/word-pipeline.ts`, `src/app/api/word/[word]/route.ts`
- Test: `src/__tests__/lib/dictionary-api.test.ts`, `src/__tests__/lib/word-pipeline.test.ts`

**Interfaces:**
- Consumes: `checkWord`, `getTextProvider`, `getImageProvider`, `getImageStore`, `compressToWebp`, `comicObjectKey`, `createServiceClient`, `buildImagePrompt`, `fetchWordFromDictionaryApi`, `getAgeGroupConfig`, `config.content.*`
- Produces:
  - `type WordResult = { found: false } | { found: true; data: WordData }`
  - `lookupWord(word: string, ageGroup: AgeGroup): Promise<WordResult>`
  - `GET /api/word/[word]?ageGroup=4-6` returning `WordData` (200), `{ error }` (404 unknown or blocked, 500 otherwise)

- [ ] **Step 1: Add the failing part-of-speech test**

Append to `src/__tests__/lib/dictionary-api.test.ts`:

```ts
it('returns the part of speech from the first meaning', async () => {
  // Drives the badge colour on every word card.
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ([{
      word: 'enormous',
      phonetics: [{ text: '/ɪˈnɔːməs/' }],
      meanings: [{
        partOfSpeech: 'adjective',
        definitions: [{ definition: 'very large in size' }],
        synonyms: ['huge', 'massive'],
      }],
    }]),
  }) as unknown as typeof fetch

  const result = await fetchWordFromDictionaryApi('enormous')
  expect(result?.partOfSpeech).toBe('adjective')
})

it('returns a null part of speech when the entry has none', async () => {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ([{ word: 'x', meanings: [{ definitions: [{ definition: 'a thing' }] }] }]),
  }) as unknown as typeof fetch

  expect((await fetchWordFromDictionaryApi('x'))?.partOfSpeech).toBeNull()
})
```

- [ ] **Step 2: Run and watch it fail**

Run: `npm test -- dictionary-api`
Expected: FAIL — `partOfSpeech` is undefined.

- [ ] **Step 3: Return the part of speech**

In `src/lib/dictionary-api.ts`, after the `firstMeaning` line:

```ts
  const firstMeaning = entry.meanings?.[0]
  const rawDefinition = firstMeaning?.definitions?.[0]?.definition ?? ''
  const partOfSpeech: string | null = firstMeaning?.partOfSpeech ?? null
```

and change the return statement to:

```ts
  return { phonetic, partOfSpeech, rawDefinition, synonyms: uniqueSynonyms }
```

Also delete the `pronunciationUrl` derivation and the `phoneticWithAudio` lookup — narration is gone, so the audio URL has no consumer. Keep `anyPhonetic` for the phonetic text:

```ts
  type PhoneticEntry = { text?: string }
  const phonetic = entry.phonetics?.find((p: PhoneticEntry) => p.text)?.text ?? null
```

- [ ] **Step 4: Run and watch it pass**

Run: `npm test -- dictionary-api`
Expected: PASS.

- [ ] **Step 5: Write the failing pipeline tests**

`src/__tests__/lib/word-pipeline.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockSingle = vi.fn()
const mockInsertSingle = vi.fn()
const mockFetchDict = vi.fn()
const mockEnrich = vi.fn()
const mockStory = vi.fn()
const mockComic = vi.fn()
const mockPut = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({ eq: () => ({ eq: () => ({ maybeSingle: mockSingle }) }) }),
      }),
      insert: () => ({ select: () => ({ single: mockInsertSingle }) }),
    }),
  }),
}))
vi.mock('@/lib/dictionary-api', () => ({ fetchWordFromDictionaryApi: mockFetchDict }))
vi.mock('@/lib/ai', () => ({
  getTextProvider: () => ({ enrichWord: mockEnrich, generateStory: mockStory }),
  getImageProvider: () => ({ generateComic: mockComic }),
}))
vi.mock('@/lib/storage', () => ({ getImageStore: () => ({ put: mockPut }) }))
vi.mock('@/lib/images/compress', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  compressToWebp: async (b: Buffer) => b,
}))

import { lookupWord } from '@/lib/word-pipeline'

const DICT = {
  phonetic: '/test/',
  partOfSpeech: 'noun',
  rawDefinition: 'a raw definition',
  synonyms: ['other'],
}

beforeEach(() => {
  vi.clearAllMocks()
  mockSingle.mockResolvedValue({ data: null })
  mockFetchDict.mockResolvedValue(DICT)
  mockEnrich.mockResolvedValue({ definition: 'Simple.', examples: ['An example.'] })
  mockStory.mockResolvedValue([
    { scene: 1, text: 'One.' }, { scene: 2, text: 'Two.' }, { scene: 3, text: 'Three.' },
  ])
  mockComic.mockResolvedValue(Buffer.from('fake-png'))
  mockPut.mockResolvedValue('https://cdn.example/comic.webp')
  mockInsertSingle.mockImplementation(async () => ({
    data: {
      id: 'row-1', word: 'dinosaur', age_group: '4-6', definition: 'Simple.',
      part_of_speech: 'noun', examples: ['An example.'], synonyms: ['other'],
      phonetic: '/test/', story_script: [], comic_image_url: 'https://cdn.example/comic.webp',
      text_version: 1, image_version: 1,
    },
  }))
})

describe('lookupWord — cache', () => {
  it('returns a cached row without calling anything else', async () => {
    mockSingle.mockResolvedValue({
      data: {
        id: 'cached-1', word: 'dinosaur', age_group: '4-6', definition: 'Cached.',
        part_of_speech: 'noun', examples: [], synonyms: [], phonetic: null,
        story_script: [], comic_image_url: null, text_version: 1, image_version: 1,
      },
    })

    const result = await lookupWord('dinosaur', '4-6')

    expect(result.found).toBe(true)
    if (result.found) expect(result.data.definition).toBe('Cached.')
    // The cache is the entire cost control. Any call past it on a hit is a bug.
    expect(mockFetchDict).not.toHaveBeenCalled()
    expect(mockEnrich).not.toHaveBeenCalled()
    expect(mockComic).not.toHaveBeenCalled()
  })
})

describe('lookupWord — safety', () => {
  it('refuses a blocked word before spending anything', async () => {
    const result = await lookupWord('porn', '4-6')
    expect(result.found).toBe(false)
    expect(mockFetchDict).not.toHaveBeenCalled()
    expect(mockEnrich).not.toHaveBeenCalled()
  })

  it('explains a sensitive word but generates no comic', async () => {
    // The definition is the useful part. Only the illustration is withheld.
    await lookupWord('death', '4-6')
    expect(mockEnrich).toHaveBeenCalled()
    expect(mockStory).not.toHaveBeenCalled()
    expect(mockComic).not.toHaveBeenCalled()
  })
})

describe('lookupWord — validation', () => {
  it('stops before any AI call when the word is not real', async () => {
    // This is what stops gibberish consuming the daily quota.
    mockFetchDict.mockResolvedValue(null)
    const result = await lookupWord('asdfgh', '4-6')
    expect(result.found).toBe(false)
    expect(mockEnrich).not.toHaveBeenCalled()
  })
})

describe('lookupWord — degradation', () => {
  it('falls back to the raw definition and does not cache when enrichment fails', async () => {
    mockEnrich.mockResolvedValue(null)
    const result = await lookupWord('dinosaur', '4-6')

    expect(result.found).toBe(true)
    if (result.found) {
      expect(result.data.definition).toBe('a raw definition')
      expect(result.data.id).toBeNull()
    }
    // Not cached: a retry next time may succeed, and a row with unimproved
    // text would be served forever.
    expect(mockInsertSingle).not.toHaveBeenCalled()
  })

  it('keeps the definition and does not cache when the story fails', async () => {
    mockStory.mockResolvedValue(null)
    const result = await lookupWord('dinosaur', '4-6')

    expect(result.found).toBe(true)
    if (result.found) expect(result.data.definition).toBe('Simple.')
    expect(mockComic).not.toHaveBeenCalled()
    expect(mockInsertSingle).not.toHaveBeenCalled()
  })

  it('caches with a null image when image generation fails', async () => {
    // Image failure DOES cache, unlike text failure: the text is worth
    // keeping and image generation is the flaky, rate-limited step.
    mockComic.mockResolvedValue(null)
    await lookupWord('dinosaur', '4-6')
    expect(mockInsertSingle).toHaveBeenCalled()
  })

  it('caches with a null image when the upload fails', async () => {
    mockPut.mockResolvedValue(null)
    await lookupWord('dinosaur', '4-6')
    expect(mockInsertSingle).toHaveBeenCalled()
  })
})

describe('lookupWord — success', () => {
  it('generates, uploads and caches', async () => {
    const result = await lookupWord('dinosaur', '4-6')
    expect(result.found).toBe(true)
    if (result.found) {
      expect(result.data.comicImageUrl).toBe('https://cdn.example/comic.webp')
      expect(result.data.id).toBe('row-1')
    }
    expect(mockPut).toHaveBeenCalled()
  })

  it('asks for the scene count matching the age group', async () => {
    await lookupWord('dinosaur', '7-10')
    expect(mockStory).toHaveBeenCalledWith('dinosaur', '7-10', 5)
  })

  it('normalises the word before doing anything', async () => {
    await lookupWord('  DINOSAUR  ', '4-6')
    expect(mockFetchDict).toHaveBeenCalledWith('dinosaur')
  })
})
```

- [ ] **Step 6: Run and watch it fail**

Run: `npm test -- word-pipeline`
Expected: FAIL — the current pipeline imports the deleted `@/lib/claude`.

- [ ] **Step 7: Rewrite the pipeline**

Replace `src/lib/word-pipeline.ts`:

```ts
import { config, getAgeGroupConfig } from '@/config'
import { createServiceClient } from '@/lib/supabase/server'
import { fetchWordFromDictionaryApi } from '@/lib/dictionary-api'
import { getImageProvider, getTextProvider } from '@/lib/ai'
import { buildImagePrompt } from '@/lib/ai/prompts'
import { getImageStore } from '@/lib/storage'
import { comicObjectKey, compressToWebp } from '@/lib/images/compress'
import { checkWord } from '@/lib/safety/check'
import type { AgeGroup, Scene, WordData } from '@/types'

export type WordResult =
  | { found: false }
  | { found: true; data: WordData }

type DbRow = {
  id: string
  word: string
  age_group: string
  definition: string
  part_of_speech: string | null
  examples: string[] | null
  synonyms: string[] | null
  phonetic: string | null
  story_script: Scene[] | null
  comic_image_url: string | null
  text_version: number
}

/** Maps a database row to the shape the UI consumes. */
export function dbRowToWordData(row: DbRow): WordData {
  return {
    id: row.id,
    word: row.word,
    ageGroup: row.age_group as AgeGroup,
    definition: row.definition,
    partOfSpeech: row.part_of_speech,
    examples: row.examples ?? [],
    synonyms: row.synonyms ?? [],
    phonetic: row.phonetic,
    storyScript: row.story_script ?? [],
    comicImageUrl: row.comic_image_url,
    textVersion: row.text_version,
  }
}

/**
 * Looks up a word, generating and caching it when it has never been seen.
 *
 * The step order is fixed and must not be rearranged. Safety and validation
 * both run before anything billable, which is what stops blocked words and
 * gibberish from consuming the daily quota.
 *
 * Every AI step degrades rather than fails. The distinction that matters:
 * text failures do NOT cache, because a row with unimproved text would be
 * served forever and a retry may succeed; image failure DOES cache, because
 * the text is worth keeping and image generation is the flaky, rate-limited
 * step.
 */
export async function lookupWord(word: string, ageGroup: AgeGroup): Promise<WordResult> {
  const normalised = word.trim().toLowerCase().slice(0, config.word.maxInputLength)

  // 1. Safety, before the cache and before any spend.
  const verdict = checkWord(normalised)
  if (verdict === 'blocked') return { found: false }
  const allowComic = verdict === 'allowed'

  const supabase = createServiceClient()

  // 2. Cache. A hit is the entire cost control — nothing below runs.
  const { data: cached } = await supabase
    .from('words')
    .select('*')
    .eq('word', normalised)
    .eq('age_group', ageGroup)
    .eq('text_version', config.content.textVersion)
    .maybeSingle()

  if (cached) return { found: true, data: dbRowToWordData(cached as DbRow) }

  // 3. Validate the word exists before calling a paid model.
  const dict = await fetchWordFromDictionaryApi(normalised)
  if (!dict) return { found: false }

  const base = {
    id: null,
    word: normalised,
    ageGroup,
    partOfSpeech: dict.partOfSpeech,
    synonyms: dict.synonyms,
    phonetic: dict.phonetic,
    textVersion: config.content.textVersion,
  }

  // 4. Enrich. On failure, show the raw dictionary text and do not cache.
  const enriched = await getTextProvider().enrichWord(normalised, dict.rawDefinition, ageGroup)
  if (!enriched) {
    return {
      found: true,
      data: {
        ...base,
        definition: dict.rawDefinition,
        examples: [],
        storyScript: [],
        comicImageUrl: null,
      },
    }
  }

  const withText = {
    ...base,
    definition: enriched.definition,
    examples: enriched.examples,
  }

  // 5. Story. Skipped entirely for sensitive words.
  const { sceneCount } = getAgeGroupConfig(ageGroup)
  const storyScript = allowComic
    ? await getTextProvider().generateStory(normalised, ageGroup, sceneCount)
    : []

  if (allowComic && !storyScript) {
    return { found: true, data: { ...withText, storyScript: [], comicImageUrl: null } }
  }

  // 6-8. Comic: generate, compress, upload. Any failure yields a null URL,
  // which still caches.
  const comicImageUrl =
    allowComic && storyScript && storyScript.length > 0
      ? await generateComicUrl(normalised, ageGroup, storyScript)
      : null

  // 9. Cache.
  const { data: inserted } = await supabase
    .from('words')
    .insert({
      word: normalised,
      age_group: ageGroup,
      definition: enriched.definition,
      part_of_speech: dict.partOfSpeech,
      examples: enriched.examples,
      synonyms: dict.synonyms,
      phonetic: dict.phonetic,
      story_script: storyScript ?? [],
      comic_image_url: comicImageUrl,
      text_version: config.content.textVersion,
      image_version: config.content.imageVersion,
    })
    .select()
    .single()

  if (inserted) return { found: true, data: dbRowToWordData(inserted as DbRow) }

  // The insert failed — a concurrent request for the same word most likely
  // won the unique constraint. Serve what was generated rather than erroring.
  return {
    found: true,
    data: { ...withText, storyScript: storyScript ?? [], comicImageUrl },
  }
}

/**
 * Generates, compresses and uploads the comic.
 *
 * Returns null on any failure. Split out so the caller reads as a linear
 * pipeline rather than three nested null checks.
 */
async function generateComicUrl(
  word: string,
  ageGroup: AgeGroup,
  scenes: Scene[],
): Promise<string | null> {
  const png = await getImageProvider().generateComic(buildImagePrompt(scenes))
  if (!png) return null

  try {
    const webp = await compressToWebp(png)
    const key = comicObjectKey(word, ageGroup, config.content.imageVersion)
    return await getImageStore().put(key, webp, `image/${config.images.format}`)
  } catch {
    // Undecodable image bytes. The text is still worth caching.
    return null
  }
}
```

- [ ] **Step 8: Run the tests and watch them pass**

Run: `npm test -- word-pipeline`
Expected: PASS, 11 tests.

- [ ] **Step 9: Rewrite the API route**

Replace `src/app/api/word/[word]/route.ts`:

```ts
import { NextResponse } from 'next/server'
import { config } from '@/config'
import { lookupWord } from '@/lib/word-pipeline'
import type { AgeGroup } from '@/types'

/**
 * The application's only API route.
 *
 * It exists because the browser cannot hold the AI key or the Supabase
 * service-role key, and cannot run sharp. Everything else — saving, reading
 * the collection, both games — happens client-side against localStorage.
 *
 * Generation can take around ten seconds on a cache miss, so the timeout is
 * raised above the platform default.
 */
export const maxDuration = 60

export async function GET(
  request: Request,
  { params }: { params: Promise<{ word: string }> },
) {
  const { word } = await params
  const decoded = decodeURIComponent(word)

  const requested = new URL(request.url).searchParams.get('ageGroup')
  const ageGroup: AgeGroup =
    requested === '7-10' || requested === '4-6' ? requested : config.defaultAgeGroup

  try {
    const result = await lookupWord(decoded, ageGroup)

    if (!result.found) {
      // Unknown and blocked words share a response. Telling a child which
      // words are blocked would invite them to go looking.
      return NextResponse.json(
        { error: "Hmm, we don't know that word!" },
        { status: 404 },
      )
    }

    return NextResponse.json(result.data)
  } catch {
    return NextResponse.json(
      { error: 'Something went wrong. Please try again!' },
      { status: 500 },
    )
  }
}
```

- [ ] **Step 10: Verify against the real APIs**

Ensure `.env.local` exists with `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` and `GOOGLE_AI_API_KEY`, then:

```bash
npm run dev
```

```bash
curl "http://localhost:3000/api/word/enormous?ageGroup=4-6"
```

Expected first call: 200 after roughly ten seconds, with a kid-friendly `definition`, two `examples`, three `storyScript` scenes, and a `comicImageUrl` pointing at Supabase.

```bash
curl "http://localhost:3000/api/word/enormous?ageGroup=4-6"
```

Expected second call: the same payload in well under a second. **If this is slow, the cache is not working — stop and fix it before continuing.** Everything downstream assumes cache hits are cheap.

```bash
curl "http://localhost:3000/api/word/asdfghjkl"
curl "http://localhost:3000/api/word/death?ageGroup=4-6"
```

Expected: 404 for the first; for the second, 200 with a definition and `"comicImageUrl": null`.

Confirm in the Supabase dashboard that `words` has the new rows and the `comics` bucket has a `.webp` object.

- [ ] **Step 11: Commit**

```bash
git add src/lib/word-pipeline.ts src/lib/dictionary-api.ts src/app/api src/__tests__/lib/word-pipeline.test.ts src/__tests__/lib/dictionary-api.test.ts
git commit -m "feat: rewrite the word pipeline for safety, providers and versioning

Safety and dictionary validation both run before anything billable, so
blocked words and gibberish never reach a model.

Text and image failures are treated differently on purpose: text failures
do not cache, because a row with unimproved wording would be served
forever and a retry may succeed, whereas image failure caches with a null
URL because the text is worth keeping and image generation is the flaky,
rate-limited step.

Unknown and blocked words return the same 404 — naming the blocked ones
would invite a child to go looking."
```

---

## Task 9: Landing page and search

**Files:**
- Create: `src/components/SearchBar.tsx`
- Modify: `src/app/page.tsx`
- Delete: `src/components/WordCard.tsx` (replaced in Task 10)

**Interfaces:**
- Consumes: `useWordStore`, `Button`, `Card`
- Produces: `<SearchBar onSearch?: (word: string) => void />` — navigates to `/search/[word]` when no handler is given

- [ ] **Step 1: Write the search bar**

`src/components/SearchBar.tsx`:

```tsx
'use client'

import { useRouter } from 'next/navigation'
import { useState, type FormEvent } from 'react'
import { config } from '@/config'
import { Button } from '@/components/ui/Button'

/**
 * The primary entry point to the application.
 *
 * Input is capped at the configured length and trimmed before navigation, so
 * a stray space cannot create a second cache entry for the same word.
 */
export function SearchBar({ initialValue = '' }: { initialValue?: string }) {
  const [value, setValue] = useState(initialValue)
  const router = useRouter()

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const word = value.trim().toLowerCase()
    if (!word) return
    router.push(`/search/${encodeURIComponent(word)}`)
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto flex w-full max-w-xl gap-2">
      <input
        type="text"
        value={value}
        onChange={e => setValue(e.target.value)}
        maxLength={config.word.maxInputLength}
        placeholder="Type any word..."
        aria-label="Search for a word"
        className="h-14 flex-1 rounded-lg border-2 border-border bg-card px-5
                   font-nunito text-lg text-foreground placeholder:text-muted-foreground
                   focus:border-primary focus:outline-none focus:ring-4 focus:ring-ring/30"
      />
      <Button type="submit" variant="playful" size="lg" disabled={!value.trim()}>
        Look up
      </Button>
    </form>
  )
}
```

- [ ] **Step 2: Write the landing page**

Replace `src/app/page.tsx`:

```tsx
'use client'

import Link from 'next/link'
import { SearchBar } from '@/components/SearchBar'
import { useWordStore } from '@/hooks/useWordStore'

/** Words that reliably produce a good comic — a starting point for a child who cannot think of one. */
const SUGGESTIONS = ['dinosaur', 'rainbow', 'adventure', 'curious']

/**
 * A client component because the stats strip reads the collection. The hero
 * and search bar render identically on server and client, so only the strip
 * waits on `loading`.
 */
export default function HomePage() {
  const { words, loading } = useWordStore()

  return (
    <main>
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          <div className="absolute left-10 top-10 h-16 w-16 rounded-full bg-sunshine/30 animate-float" />
          <div className="absolute right-20 top-32 h-12 w-12 rounded-full bg-coral/30 animate-bounce-soft" />
          <div className="absolute bottom-10 left-1/4 h-20 w-20 rounded-full bg-lavender/30 animate-float"
               style={{ animationDelay: '1s' }} />
          <div className="absolute bottom-20 right-1/3 h-10 w-10 rounded-full bg-mint/30 animate-bounce-soft"
               style={{ animationDelay: '0.5s' }} />
        </div>

        <div className="container relative mx-auto px-4 py-12 md:py-20">
          <div className="mb-10 text-center">
            <p className="mb-6 inline-flex items-center gap-2 rounded-full bg-sunshine/20 px-4 py-2
                          font-nunito font-bold text-sunshine-foreground">
              Every word you look up is saved for you
            </p>
            <h1 className="mb-4 font-fredoka text-4xl font-bold md:text-6xl">
              Discover the <span className="text-gradient">Magic of Words</span>
            </h1>
            <p className="mx-auto max-w-2xl font-nunito text-xl text-muted-foreground">
              Type any word to find out what it means and see it come to life in a comic.
            </p>
          </div>

          <SearchBar />

          <div className="mt-12 flex flex-wrap items-center justify-center gap-3">
            <span className="font-nunito text-muted-foreground">Try searching:</span>
            {SUGGESTIONS.map(word => (
              <Link
                key={word}
                href={`/search/${word}`}
                className="rounded-full border-2 border-border bg-card px-4 py-2 font-nunito
                           font-bold transition-all hover:border-primary hover:bg-primary/5"
              >
                {word}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {!loading && words.length > 0 && (
        <section className="border-t-2 border-border bg-card/50">
          <div className="container mx-auto flex flex-wrap items-center justify-center gap-8 px-4 py-8">
            <div>
              <p className="font-fredoka text-3xl font-bold text-primary">{words.length}</p>
              <p className="font-nunito text-sm text-muted-foreground">
                {words.length === 1 ? 'word learned' : 'words learned'}
              </p>
            </div>
            <Link href="/dictionary" className="font-nunito font-bold text-primary hover:underline">
              See my words →
            </Link>
          </div>
        </section>
      )}
    </main>
  )
}
```

- [ ] **Step 3: Delete the old word card**

```bash
rm -f src/components/WordCard.tsx
```

- [ ] **Step 4: Look at it in a browser**

`npm run dev`, then drive Playwright to `http://localhost:3000`.

Check: floating shapes animate, the headline gradient runs teal to sky, the search bar is centred with a chunky button that presses down on click, the suggestion pills render, **no console errors**, no hydration warning. Typing a word and submitting navigates to `/search/<word>` — a 404 page at this point is expected.

Screenshot at 390px wide as well: nothing should overflow horizontally.

- [ ] **Step 5: Commit**

```bash
git add src/app/page.tsx src/components/SearchBar.tsx
git rm --cached src/components/WordCard.tsx 2>/dev/null || true
git commit -m "feat: rebuild the landing page with the new design system

Search input is trimmed and lowercased before navigation so a stray space
cannot create a second cache entry for the same word.

The stats strip waits on the store's loading flag; the hero and search bar
render identically on server and client, so only that strip is gated."
```

---

## Task 10: The word page and auto-save

**Files:**
- Create: `src/components/DictionaryEntry.tsx`, `src/components/ComicStrip.tsx`, `src/components/WordPageClient.tsx`
- Modify: `src/app/search/[word]/page.tsx`
- Delete: `src/components/DictionaryEntry.tsx` old version, `src/components/ComicStorybook.tsx`, `src/components/AddToDictionaryButton.tsx`

**Interfaces:**
- Consumes: `lookupWord`, `useWordStore`, `useAgeGroup`, `Badge`, `Card`, `SearchBar`
- Produces: `<WordPageClient data={WordData} />` — renders the entry and performs the auto-save

- [ ] **Step 1: Delete the superseded components**

```bash
rm -f src/components/DictionaryEntry.tsx src/components/ComicStorybook.tsx src/components/AddToDictionaryButton.tsx
```

`ComicStorybook` carried the Web Speech narration, which is out of scope. `AddToDictionaryButton` is replaced by auto-save.

- [ ] **Step 2: Write the comic strip**

`src/components/ComicStrip.tsx`:

```tsx
'use client'

import { useState } from 'react'
import type { Scene } from '@/types'

/**
 * The generated comic and its scene text.
 *
 * The image is rendered with a plain <img> rather than next/image: the source
 * is an already-compressed WebP on a CDN with a one-year cache header, so
 * Next's optimiser would add a second round of processing for no gain.
 *
 * An image that fails to load hides itself and leaves the scene text, which
 * is the graceful-degradation requirement — a child must never see a broken
 * image icon where a story should be.
 */
export function ComicStrip({
  word,
  imageUrl,
  scenes,
}: {
  word: string
  imageUrl: string | null
  scenes: Scene[]
}) {
  const [imageFailed, setImageFailed] = useState(false)

  if (!imageUrl && scenes.length === 0) return null

  return (
    <section className="mt-8">
      <h2 className="mb-4 font-fredoka text-2xl font-bold">A story about {word}</h2>

      {imageUrl && !imageFailed && (
        <img
          src={imageUrl}
          alt={`A comic strip showing what ${word} means`}
          onError={() => setImageFailed(true)}
          className="w-full rounded-2xl border-2 border-border shadow-card"
        />
      )}

      {scenes.length > 0 && (
        <ol className="mt-4 space-y-3">
          {scenes.map(scene => (
            <li key={scene.scene} className="flex gap-3 font-nunito text-lg">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg
                               bg-primary font-fredoka font-bold text-primary-foreground">
                {scene.scene}
              </span>
              <span className="pt-0.5">{scene.text}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
```

- [ ] **Step 3: Write the dictionary entry**

`src/components/DictionaryEntry.tsx`:

```tsx
import Link from 'next/link'
import { Badge } from '@/components/ui/Badge'
import { Card, CardContent } from '@/components/ui/Card'
import type { WordData } from '@/types'

/**
 * The written half of a word page: the word, how it sounds, what it means,
 * examples and synonyms.
 *
 * Rendered above the comic so the definition is never gated on image loading.
 * A child who came to find out what a word means gets that first.
 */
export function DictionaryEntry({ data }: { data: WordData }) {
  return (
    <Card>
      <CardContent>
        <div className="mb-2 flex flex-wrap items-center gap-3">
          <h1 className="font-fredoka text-4xl font-bold capitalize md:text-5xl">{data.word}</h1>
          <Badge partOfSpeech={data.partOfSpeech} />
        </div>

        {data.phonetic && (
          <p className="mb-4 font-nunito text-lg text-muted-foreground">{data.phonetic}</p>
        )}

        <p className="font-nunito text-xl leading-relaxed">{data.definition}</p>

        {data.examples.length > 0 && (
          <div className="mt-6">
            <h2 className="mb-2 font-fredoka text-xl font-bold">Examples</h2>
            <ul className="space-y-2">
              {data.examples.map((example, i) => (
                <li
                  key={i}
                  className="rounded-lg border-l-4 border-sunshine bg-sunshine/10 px-4 py-2
                             font-nunito text-lg"
                >
                  {example}
                </li>
              ))}
            </ul>
          </div>
        )}

        {data.synonyms.length > 0 && (
          <div className="mt-6">
            <h2 className="mb-2 font-fredoka text-xl font-bold">Words that mean the same</h2>
            <div className="flex flex-wrap gap-2">
              {/* Each synonym is a link, so one lookup leads to the next. */}
              {data.synonyms.map(synonym => (
                <Link
                  key={synonym}
                  href={`/search/${encodeURIComponent(synonym)}`}
                  className="rounded-full border-2 border-border bg-card px-4 py-2 font-nunito
                             font-bold transition-all hover:border-primary hover:bg-primary/5"
                >
                  {synonym}
                </Link>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 4: Write the auto-save client wrapper**

`src/components/WordPageClient.tsx`:

```tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { DictionaryEntry } from '@/components/DictionaryEntry'
import { ComicStrip } from '@/components/ComicStrip'
import { useWordStore } from '@/hooks/useWordStore'
import type { WordData } from '@/types'

/**
 * Renders a word and saves it to the collection automatically.
 *
 * Auto-save replaces the previous explicit button: a five-year-old should not
 * have to understand that looking a word up and keeping it are separate
 * actions.
 *
 * The save runs once per mount, guarded by a ref. Without the guard, adding to
 * the store triggers a re-read, which changes `words`, which would re-run the
 * effect — a loop.
 */
export function WordPageClient({ data }: { data: WordData }) {
  const { addWord, loading } = useWordStore()
  const [saved, setSaved] = useState(false)
  const hasSaved = useRef(false)

  useEffect(() => {
    if (loading || hasSaved.current) return
    hasSaved.current = true

    void addWord({
      word: data.word,
      definition: data.definition,
      partOfSpeech: data.partOfSpeech,
      examples: data.examples,
      synonyms: data.synonyms,
      phonetic: data.phonetic,
      comicImageUrl: data.comicImageUrl,
      ageGroup: data.ageGroup,
      textVersion: data.textVersion,
      addedAt: new Date().toISOString(),
    }).then(() => setSaved(true))
  }, [loading, data, addWord])

  return (
    <>
      {saved && (
        <p className="mb-4 text-center font-nunito font-bold text-primary animate-pop">
          Saved to My Words
        </p>
      )}
      <DictionaryEntry data={data} />
      <ComicStrip word={data.word} imageUrl={data.comicImageUrl} scenes={data.storyScript} />
    </>
  )
}
```

- [ ] **Step 5: Write the word page**

Replace `src/app/search/[word]/page.tsx`:

```tsx
import Link from 'next/link'
import { config } from '@/config'
import { lookupWord } from '@/lib/word-pipeline'
import { WordPageClient } from '@/components/WordPageClient'
import { SearchBar } from '@/components/SearchBar'
import { Card, CardContent } from '@/components/ui/Card'
import type { AgeGroup } from '@/types'

/**
 * A server component, so generation happens on the server and the page
 * arrives complete. Generation can take around ten seconds on a cache miss.
 *
 * The age group comes from the query string rather than localStorage because
 * this component cannot read localStorage. The header toggle writes the
 * preference; links carry it forward. Without one, the default applies.
 */
export default async function WordPage({
  params,
  searchParams,
}: {
  params: Promise<{ word: string }>
  searchParams: Promise<{ ageGroup?: string }>
}) {
  const { word } = await params
  const { ageGroup: requested } = await searchParams
  const decoded = decodeURIComponent(word)

  const ageGroup: AgeGroup =
    requested === '7-10' || requested === '4-6' ? requested : config.defaultAgeGroup

  const result = await lookupWord(decoded, ageGroup)

  if (!result.found) {
    return (
      <main className="container mx-auto max-w-2xl px-4 py-12">
        <Card>
          <CardContent className="text-center">
            <h1 className="mb-2 font-fredoka text-3xl font-bold">
              Hmm, we don&apos;t know that word!
            </h1>
            <p className="mb-6 font-nunito text-lg text-muted-foreground">
              Check the spelling and try again, or look up a different word.
            </p>
            <SearchBar />
            <Link href="/" className="mt-6 inline-block font-nunito font-bold text-primary hover:underline">
              ← Back home
            </Link>
          </CardContent>
        </Card>
      </main>
    )
  }

  return (
    <main className="container mx-auto max-w-2xl px-4 py-8">
      <WordPageClient data={result.data} />
      <div className="mt-8">
        <SearchBar />
      </div>
    </main>
  )
}
```

- [ ] **Step 6: Look at it in a browser**

`npm run dev`, then drive Playwright through:

1. `/search/enormous` — first load takes roughly ten seconds. Confirm the word, badge, phonetic, definition, examples and synonyms render; the comic appears below; "Saved to My Words" pops in.
2. Reload — should be fast, and "Saved to My Words" appears again without duplicating the entry.
3. `/search/asdfghjkl` — the not-found card with a working search bar.
4. `/search/death` — definition renders, no comic, no broken image icon.
5. Click a synonym — navigates to that word's page.

**No console errors. No hydration warning.** Screenshot at 390px and 1280px.

- [ ] **Step 7: Verify the auto-save actually persisted**

In the browser console:

```js
JSON.parse(localStorage.getItem('kd.words.v1'))
```

Expected: an array containing `enormous` and `death`, each with a full `definition`, and `comicImageUrl` as a URL string for `enormous` and `null` for `death`.

- [ ] **Step 8: Commit**

```bash
git add src/app/search src/components
git commit -m "feat: rebuild the word page with auto-save

Looking a word up now saves it, replacing the explicit button — a
five-year-old should not have to understand that finding out what a word
means and keeping it are separate actions.

The save is guarded by a ref because adding to the store triggers a
re-read, which would otherwise re-run the effect in a loop.

The definition renders above the comic so it is never gated on image
loading, and a comic that fails to load hides itself and leaves the scene
text rather than showing a broken image."
```

---

## Task 11: Quiz generation logic

Pure logic. Precedes both the dictionary page and the quiz page, because quiz-to-delete uses the same question builder.

**Files:**
- Modify: `src/lib/quiz.ts`
- Test: `src/__tests__/lib/quiz.test.ts`

**Interfaces:**
- Consumes: `config.games.*`, `SavedWord`, `QuizQuestion`
- Produces:
  - `generateQuizQuestions(words: SavedWord[], count?: number): QuizQuestion[]`
  - `buildQuestionFor(target: SavedWord, pool: SavedWord[]): QuizQuestion | null`

- [ ] **Step 1: Write the failing tests**

Replace `src/__tests__/lib/quiz.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { generateQuizQuestions, buildQuestionFor } from '@/lib/quiz'
import type { SavedWord } from '@/lib/store/types'
import { config } from '@/config'

function makeWords(count: number): SavedWord[] {
  return Array.from({ length: count }, (_, i) => ({
    word: `word${i}`,
    definition: `Definition number ${i}.`,
    partOfSpeech: 'noun',
    examples: [],
    synonyms: [],
    phonetic: null,
    comicImageUrl: null,
    ageGroup: '4-6' as const,
    textVersion: 1,
    addedAt: new Date().toISOString(),
  }))
}

describe('generateQuizQuestions', () => {
  it('returns nothing below the minimum collection size', () => {
    expect(generateQuizQuestions(makeWords(config.games.minWordsRequired - 1))).toEqual([])
  })

  it('builds a full question at exactly the minimum', () => {
    // Four saved words leave exactly three others as wrong answers, which is
    // what a four-choice question needs. This is why no server-side source of
    // extra words is required.
    const questions = generateQuizQuestions(makeWords(config.games.minWordsRequired))
    expect(questions.length).toBeGreaterThan(0)
    expect(questions[0].choices).toHaveLength(config.games.mcqChoices)
  })

  it('caps the question count at the collection size', () => {
    // Repeating words to reach a fixed length would produce a literally
    // identical screen with the buttons shuffled, which reads as a bug.
    expect(generateQuizQuestions(makeWords(4))).toHaveLength(4)
    expect(generateQuizQuestions(makeWords(6))).toHaveLength(6)
  })

  it('never exceeds the configured question count', () => {
    expect(generateQuizQuestions(makeWords(50))).toHaveLength(config.games.quizQuestionCount)
  })

  it('asks each word at most once', () => {
    const prompts = generateQuizQuestions(makeWords(6)).map(q => q.prompt)
    expect(new Set(prompts).size).toBe(prompts.length)
  })

  it('points answerIndex at the correct choice in every question', () => {
    const words = makeWords(8)
    for (const question of generateQuizQuestions(words)) {
      const answer = question.choices[question.answerIndex]
      const source = words.find(w =>
        question.mode === 'word-to-meaning' ? w.word === question.prompt : w.definition === question.prompt
      )
      expect(source).toBeDefined()
      expect(answer).toBe(question.mode === 'word-to-meaning' ? source!.definition : source!.word)
    }
  })

  it('never repeats a choice within a question', () => {
    for (const question of generateQuizQuestions(makeWords(10))) {
      expect(new Set(question.choices).size).toBe(question.choices.length)
    }
  })

  it('uses both question modes across a long enough quiz', () => {
    const modes = new Set(generateQuizQuestions(makeWords(10)).map(q => q.mode))
    expect(modes.size).toBe(2)
  })
})

describe('buildQuestionFor', () => {
  it('builds a question about a specific word', () => {
    const words = makeWords(5)
    const question = buildQuestionFor(words[0], words)
    expect(question).not.toBeNull()
    expect(question!.choices).toContain(words[0].definition)
  })

  it('returns null when there are too few other words', () => {
    const words = makeWords(2)
    expect(buildQuestionFor(words[0], words)).toBeNull()
  })

  it('excludes the target from its own wrong answers', () => {
    const words = makeWords(5)
    const question = buildQuestionFor(words[0], words)!
    const occurrences = question.choices.filter(c => c === words[0].definition)
    expect(occurrences).toHaveLength(1)
  })
})
```

- [ ] **Step 2: Run and watch it fail**

Run: `npm test -- quiz`
Expected: FAIL — `buildQuestionFor` is not exported, and the current signature takes `UserWord`.

- [ ] **Step 3: Rewrite the quiz logic**

Replace `src/lib/quiz.ts`:

```ts
import { config } from '@/config'
import type { SavedWord } from '@/lib/store/types'
import type { QuizMode, QuizQuestion } from '@/types'

/**
 * Builds one multiple-choice question about a specific word.
 *
 * Wrong answers come only from the user's other saved words. At the minimum
 * collection size of four, removing the target leaves exactly three others —
 * precisely what a four-choice question needs, which is why the quiz needs no
 * server-side source of extra vocabulary.
 *
 * Returns null when the pool cannot supply enough wrong answers.
 */
export function buildQuestionFor(
  target: SavedWord,
  pool: SavedWord[],
  mode: QuizMode = Math.random() < 0.5 ? 'word-to-meaning' : 'meaning-to-word',
): QuizQuestion | null {
  const others = pool.filter(w => w.word.toLowerCase() !== target.word.toLowerCase())
  const needed = config.games.mcqChoices - 1
  if (others.length < needed) return null

  const distractors = shuffle(others).slice(0, needed)

  const correct = mode === 'word-to-meaning' ? target.definition : target.word
  const wrong = distractors.map(w => (mode === 'word-to-meaning' ? w.definition : w.word))

  // Shuffled so the correct answer does not sit in the same position every
  // time — with a small collection the choices repeat, and a fixed position
  // would make the quiz trivially guessable.
  const choices = shuffle([correct, ...wrong])

  return {
    mode,
    prompt: mode === 'word-to-meaning' ? target.word : target.definition,
    choices,
    answerIndex: choices.indexOf(correct),
  }
}

/**
 * Builds a quiz from the user's collection.
 *
 * The question count is capped at the collection size rather than repeating
 * words to reach a fixed length. With only four saved words there are only
 * three possible wrong answers, so a repeated word produces a literally
 * identical screen with the buttons shuffled — that reads as a bug rather
 * than as revision. A short quiz that ends deliberately is better than a long
 * one that visibly loops.
 */
export function generateQuizQuestions(
  words: SavedWord[],
  count: number = config.games.quizQuestionCount,
): QuizQuestion[] {
  if (words.length < config.games.minWordsRequired) return []

  const targets = shuffle(words).slice(0, Math.min(count, words.length))

  return targets
    .map((target, i) =>
      // Alternate modes so a quiz always mixes both directions rather than
      // landing on one by chance.
      buildQuestionFor(target, words, i % 2 === 0 ? 'word-to-meaning' : 'meaning-to-word'),
    )
    .filter((q): q is QuizQuestion => q !== null)
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}
```

- [ ] **Step 4: Run the tests and watch them pass**

Run: `npm test -- quiz`
Expected: PASS, 11 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/quiz.ts src/__tests__/lib/quiz.test.ts
git commit -m "feat: rewrite quiz generation for local-only collections

Wrong answers come only from the user's other saved words. Four saved
words leave exactly the three others a four-choice question needs, so no
server-side source of extra vocabulary is required.

Question count is capped at the collection size instead of repeating words
to reach a fixed length: with four words there are only three possible
wrong answers, so a repeat is the same screen with shuffled buttons."
```

---

## Task 12: The dictionary page and quiz-to-delete

**Files:**
- Create: `src/components/RemoveWordQuiz.tsx`, `src/components/WordListCard.tsx`
- Modify: `src/app/dictionary/page.tsx`

**Interfaces:**
- Consumes: `useWordStore`, `buildQuestionFor`, `Badge`, `Button`, `Card`
- Produces: `<RemoveWordQuiz word allWords onCorrect onCancel />`, `<WordListCard entry onRemove />`

- [ ] **Step 1: Write the removal quiz**

`src/components/RemoveWordQuiz.tsx`:

```tsx
'use client'

import { useMemo, useState } from 'react'
import { buildQuestionFor } from '@/lib/quiz'
import type { SavedWord } from '@/lib/store/types'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'

/**
 * Requires a correct answer before a word leaves the collection.
 *
 * Removal is the only destructive action in the application, and the audience
 * is children. Answering a question about the word prevents accidental loss
 * and turns deletion into a moment of recall.
 *
 * When the collection is too small to build a question, removal proceeds with
 * a plain confirmation — a child must never be unable to remove a word.
 */
export function RemoveWordQuiz({
  word,
  allWords,
  onCorrect,
  onCancel,
}: {
  word: SavedWord
  allWords: SavedWord[]
  onCorrect: () => void
  onCancel: () => void
}) {
  // Built once: rebuilding on each render would reshuffle the choices under
  // the child's finger.
  const question = useMemo(
    () => buildQuestionFor(word, allWords, 'word-to-meaning'),
    [word, allWords],
  )
  const [wrongIndex, setWrongIndex] = useState<number | null>(null)

  if (!question) {
    return (
      <Card>
        <CardContent className="text-center">
          <h2 className="mb-4 font-fredoka text-2xl font-bold">
            Remove &ldquo;{word.word}&rdquo;?
          </h2>
          <div className="flex justify-center gap-3">
            <Button variant="outline" onClick={onCancel}>Keep it</Button>
            <Button variant="destructive" onClick={onCorrect}>Remove</Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  function handleAnswer(index: number) {
    if (index === question!.answerIndex) onCorrect()
    else setWrongIndex(index)
  }

  return (
    <Card>
      <CardContent>
        <h2 className="mb-2 font-fredoka text-2xl font-bold">One last question!</h2>
        <p className="mb-6 font-nunito text-muted-foreground">
          Answer correctly to remove &ldquo;{word.word}&rdquo; from your words.
        </p>

        <p className="mb-4 font-fredoka text-xl">
          What does <span className="text-primary">{question.prompt}</span> mean?
        </p>

        <div className="space-y-2">
          {question.choices.map((choice, index) => (
            <button
              key={index}
              onClick={() => handleAnswer(index)}
              className={[
                'w-full rounded-lg border-2 p-4 text-left font-nunito text-lg transition-all',
                'min-h-[3rem] hover:border-primary hover:bg-primary/5',
                wrongIndex === index
                  ? 'border-coral bg-coral/10 animate-shake'
                  : 'border-border bg-card',
              ].join(' ')}
            >
              {choice}
            </button>
          ))}
        </div>

        {wrongIndex !== null && (
          <p className="mt-4 font-nunito text-coral">Not quite — have another go!</p>
        )}

        <Button variant="ghost" onClick={onCancel} className="mt-6 w-full">
          Cancel, keep this word
        </Button>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 2: Write the list card**

`src/components/WordListCard.tsx`:

```tsx
import Link from 'next/link'
import { Badge } from '@/components/ui/Badge'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import type { SavedWord } from '@/lib/store/types'

export function WordListCard({
  entry,
  onRemove,
}: {
  entry: SavedWord
  onRemove: () => void
}) {
  return (
    <Card className="transition-all hover:border-primary/40">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex items-center gap-2">
              <Link
                href={`/search/${encodeURIComponent(entry.word)}`}
                className="truncate font-fredoka text-xl font-bold capitalize hover:text-primary"
              >
                {entry.word}
              </Link>
              <Badge partOfSpeech={entry.partOfSpeech} />
            </div>
            <p className="line-clamp-2 font-nunito text-sm text-muted-foreground">
              {entry.definition}
            </p>
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={onRemove}
            aria-label={`Remove ${entry.word}`}
            title="Remove — you'll need to answer a question first"
            className="shrink-0 text-coral hover:bg-coral/10"
          >
            ✕
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 3: Write the dictionary page**

Replace `src/app/dictionary/page.tsx`:

```tsx
'use client'

import Link from 'next/link'
import { useState } from 'react'
import { config } from '@/config'
import { useWordStore } from '@/hooks/useWordStore'
import { WordListCard } from '@/components/WordListCard'
import { RemoveWordQuiz } from '@/components/RemoveWordQuiz'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import type { SavedWord } from '@/lib/store/types'

/**
 * The user's collection.
 *
 * A client component throughout: the collection lives in localStorage, which
 * does not exist during server rendering. The loading state is not optional —
 * rendering the empty state first would tell a child their words are gone.
 */
export default function DictionaryPage() {
  const { words, loading, removeWord } = useWordStore()
  const [sortAlphabetically, setSortAlphabetically] = useState(false)
  const [pendingRemoval, setPendingRemoval] = useState<SavedWord | null>(null)

  if (loading) {
    return (
      <main className="container mx-auto px-4 py-12 text-center">
        <p className="font-nunito text-muted-foreground">Loading your words...</p>
      </main>
    )
  }

  if (pendingRemoval) {
    return (
      <main className="container mx-auto max-w-lg px-4 py-8">
        <RemoveWordQuiz
          word={pendingRemoval}
          allWords={words}
          onCorrect={async () => {
            await removeWord(pendingRemoval.word)
            setPendingRemoval(null)
          }}
          onCancel={() => setPendingRemoval(null)}
        />
      </main>
    )
  }

  const displayed = sortAlphabetically
    ? [...words].sort((a, b) => a.word.localeCompare(b.word))
    : words

  return (
    <main className="container mx-auto px-4 py-8">
      <div className="mb-8 text-center">
        <h1 className="mb-2 font-fredoka text-3xl font-bold md:text-4xl">My Words</h1>
        <p className="font-nunito text-muted-foreground">
          {words.length === 0
            ? 'Look up a word and it will appear here.'
            : `You have learned ${words.length} ${words.length === 1 ? 'word' : 'words'}.`}
        </p>
      </div>

      {words.length === 0 ? (
        <Card className="mx-auto max-w-md">
          <CardContent className="text-center">
            <h2 className="mb-2 font-fredoka text-xl font-bold">No words yet</h2>
            <p className="mb-6 font-nunito text-muted-foreground">
              Every word you look up is saved here automatically.
            </p>
            <Link href="/">
              <Button variant="playful">Start looking up words</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <Button
              variant={sortAlphabetically ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSortAlphabetically(!sortAlphabetically)}
            >
              {sortAlphabetically ? 'A–Z' : 'Newest first'}
            </Button>

            {words.length >= config.games.minWordsRequired && (
              <div className="flex gap-2">
                <Link href="/games/quiz"><Button variant="playful" size="sm">Play quiz</Button></Link>
                <Link href="/games/crossword"><Button variant="outline" size="sm">Crossword</Button></Link>
              </div>
            )}
          </div>

          {words.length < config.games.minWordsRequired && (
            <p className="mb-6 rounded-xl border-2 border-sunshine/30 bg-sunshine/20 p-4
                          text-center font-nunito text-sunshine-foreground">
              Learn {config.games.minWordsRequired - words.length} more{' '}
              {config.games.minWordsRequired - words.length === 1 ? 'word' : 'words'} to unlock the games!
            </p>
          )}

          <div className="grid gap-3 md:grid-cols-2">
            {displayed.map(entry => (
              <WordListCard
                key={entry.word}
                entry={entry}
                onRemove={() => setPendingRemoval(entry)}
              />
            ))}
          </div>
        </>
      )}
    </main>
  )
}
```

- [ ] **Step 4: Look at it in a browser**

`npm run dev`. Look up four or five words first so the collection is populated, then drive Playwright to `/dictionary`.

Check: cards render with badges and truncated definitions; the A–Z toggle re-sorts; clicking ✕ shows the removal quiz; a **wrong** answer shakes and keeps the word; a **correct** answer removes it and returns to the list; Cancel keeps the word. Reload and confirm removals persisted. Clear localStorage and confirm the empty state. **No console errors.**

- [ ] **Step 5: Commit**

```bash
git add src/app/dictionary src/components/RemoveWordQuiz.tsx src/components/WordListCard.tsx
git commit -m "feat: rebuild the dictionary page with quiz-to-delete

Removal is the only destructive action in the app and the audience is
children, so it requires answering a question about the word. That
prevents accidental loss and turns deletion into a moment of recall.

When the collection is too small to build a question, removal falls back
to a plain confirmation — a child must never be unable to remove a word.

The loading state is not optional here: rendering the empty state before
localStorage has been read would tell a child their words are gone."
```

---

## Task 13: The quiz page

**Files:**
- Create: `src/components/games/NotEnoughWords.tsx`, `src/components/games/QuizGame.tsx`
- Modify: `src/app/games/quiz/page.tsx`
- Delete: `src/app/games/page.tsx`, `src/components/games/CrosswordGame.tsx` (rewritten in Task 14)

**Interfaces:**
- Consumes: `useWordStore`, `generateQuizQuestions`, `Button`, `Card`
- Produces: `<NotEnoughWords have={number} />`, `<QuizGame words={SavedWord[]} />`

- [ ] **Step 1: Remove the games hub**

```bash
rm -rf src/app/games/page.tsx
rm -f src/components/games/QuizGame.tsx src/components/games/CrosswordGame.tsx
```

The hub linked to protected routes and duplicated navigation the header now carries.

- [ ] **Step 2: Write the shared gate**

`src/components/games/NotEnoughWords.tsx`:

```tsx
import Link from 'next/link'
import { config } from '@/config'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'

/**
 * Shown when the collection is too small to build a game.
 *
 * Framed as progress towards unlocking rather than as a refusal — the child
 * is told how many more words they need and given the way to get them.
 */
export function NotEnoughWords({ have }: { have: number }) {
  const needed = config.games.minWordsRequired - have

  return (
    <Card className="mx-auto max-w-md">
      <CardContent className="text-center">
        <h2 className="mb-2 font-fredoka text-2xl font-bold">Almost ready!</h2>
        <p className="mb-6 font-nunito text-lg text-muted-foreground">
          Look up {needed} more {needed === 1 ? 'word' : 'words'} to start playing.
          You have {have} so far.
        </p>
        <Link href="/">
          <Button variant="playful">Look up a word</Button>
        </Link>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 3: Write the quiz game**

`src/components/games/QuizGame.tsx`:

```tsx
'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { generateQuizQuestions } from '@/lib/quiz'
import type { SavedWord } from '@/lib/store/types'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'

/**
 * A round of multiple-choice questions over the user's collection.
 *
 * Questions are generated once per round via useMemo. Regenerating on render
 * would reshuffle the choices under the child's finger mid-question.
 *
 * A wrong answer reveals the correct one and moves on rather than allowing a
 * retry, so the score means something and the round always ends.
 */
export function QuizGame({ words }: { words: SavedWord[] }) {
  const [round, setRound] = useState(0)
  const questions = useMemo(() => generateQuizQuestions(words), [words, round])

  const [index, setIndex] = useState(0)
  const [chosen, setChosen] = useState<number | null>(null)
  const [score, setScore] = useState(0)

  const question = questions[index]
  const finished = index >= questions.length

  function choose(choiceIndex: number) {
    // Ignore taps after the first: the answer is already revealed.
    if (chosen !== null) return
    setChosen(choiceIndex)
    if (choiceIndex === question.answerIndex) setScore(s => s + 1)
  }

  function next() {
    setChosen(null)
    setIndex(i => i + 1)
  }

  function playAgain() {
    setIndex(0)
    setChosen(null)
    setScore(0)
    setRound(r => r + 1)
  }

  if (finished) {
    const perfect = score === questions.length
    return (
      <Card className="mx-auto max-w-md">
        <CardContent className="text-center">
          <h2 className="mb-2 font-fredoka text-3xl font-bold">
            {perfect ? 'Perfect!' : 'Well done!'}
          </h2>
          <p className="mb-6 font-nunito text-xl">
            You got <span className="font-bold text-primary">{score}</span> out of{' '}
            {questions.length}.
          </p>
          <div className="flex justify-center gap-3">
            <Button variant="playful" onClick={playAgain}>Play again</Button>
            <Link href="/dictionary"><Button variant="outline">My words</Button></Link>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="mx-auto max-w-2xl">
      <CardContent>
        <p className="mb-4 font-nunito text-sm text-muted-foreground">
          Question {index + 1} of {questions.length}
        </p>

        <h2 className="mb-6 font-fredoka text-2xl font-bold">
          {question.mode === 'word-to-meaning'
            ? <>What does <span className="text-primary">{question.prompt}</span> mean?</>
            : <>Which word means: <span className="text-primary">{question.prompt}</span></>}
        </h2>

        <div className="space-y-2">
          {question.choices.map((choice, i) => {
            const isAnswer = i === question.answerIndex
            const isChosen = i === chosen
            // Colour only appears after an answer, so it never hints.
            const state =
              chosen === null ? 'border-border bg-card hover:border-primary hover:bg-primary/5'
              : isAnswer ? 'border-mint bg-mint/20'
              : isChosen ? 'border-coral bg-coral/20 animate-shake'
              : 'border-border bg-card opacity-60'

            return (
              <button
                key={i}
                onClick={() => choose(i)}
                disabled={chosen !== null}
                className={`w-full min-h-[3rem] rounded-lg border-2 p-4 text-left font-nunito text-lg transition-all ${state}`}
              >
                {choice}
              </button>
            )
          })}
        </div>

        {chosen !== null && (
          <div className="mt-6 flex items-center justify-between gap-4">
            <p className="font-nunito font-bold">
              {chosen === question.answerIndex ? 'Correct!' : 'The right answer is highlighted.'}
            </p>
            <Button variant="playful" onClick={next}>
              {index === questions.length - 1 ? 'See my score' : 'Next'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 4: Write the quiz page**

Replace `src/app/games/quiz/page.tsx`:

```tsx
'use client'

import { config } from '@/config'
import { useWordStore } from '@/hooks/useWordStore'
import { QuizGame } from '@/components/games/QuizGame'
import { NotEnoughWords } from '@/components/games/NotEnoughWords'

/**
 * Client-only: the quiz reads the collection from localStorage and needs no
 * server involvement at all.
 */
export default function QuizPage() {
  const { words, loading } = useWordStore()

  return (
    <main className="container mx-auto px-4 py-8">
      <h1 className="mb-8 text-center font-fredoka text-3xl font-bold md:text-4xl">
        Word Quiz
      </h1>

      {loading ? (
        <p className="text-center font-nunito text-muted-foreground">Loading your words...</p>
      ) : words.length < config.games.minWordsRequired ? (
        <NotEnoughWords have={words.length} />
      ) : (
        <QuizGame words={words} />
      )}
    </main>
  )
}
```

- [ ] **Step 5: Look at it in a browser**

`npm run dev`. With fewer than four saved words, `/games/quiz` shows the gate with the correct count. With four or more, play a full round: check that choices are unstyled before answering, that a correct answer turns mint and a wrong one shakes in coral while revealing the answer, that the score is right at the end, and that "Play again" produces a fresh shuffle. **No console errors.**

- [ ] **Step 6: Commit**

```bash
git add src/app/games/quiz src/components/games
git rm -r --cached src/app/games/page.tsx 2>/dev/null || true
git commit -m "feat: rebuild the quiz to read localStorage directly

The quiz runs entirely in the browser — no API route, no auth check. It
regenerates questions only when the round changes, since regenerating on
render would reshuffle the choices under the child's finger.

Choices carry no colour until an answer is given, so styling never hints
at the correct one, and a wrong answer reveals the answer and moves on so
the score means something."
```

---

## Task 14: The crossword page

**Files:**
- Create: `src/components/games/CrosswordGame.tsx`
- Modify: `src/app/games/crossword/page.tsx`

**Interfaces:**
- Consumes: `useWordStore`, `crossword-layout-generator`, `NotEnoughWords`, `Button`, `Card`
- Produces: `<CrosswordGame words={SavedWord[]} />`

- [ ] **Step 1: Write the crossword game**

`src/components/games/CrosswordGame.tsx`:

```tsx
'use client'

import { useMemo, useState } from 'react'
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — the package ships no type declarations
import clg from 'crossword-layout-generator'
import type { SavedWord } from '@/lib/store/types'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'

type PlacedWord = {
  answer: string
  clue: string
  startx: number
  starty: number
  orientation: 'across' | 'down' | 'none'
  position: number
}

/**
 * A crossword built from the user's collection, laid out in the browser.
 *
 * The layout generator places what it can and marks the rest with
 * `orientation: 'none'`. Those are filtered out rather than treated as an
 * error — with a small or awkward set of words, some will not fit, and a
 * partial crossword is still playable.
 */
export function CrosswordGame({ words }: { words: SavedWord[] }) {
  const layout = useMemo(() => {
    const input = words.map(w => ({ clue: w.definition, answer: w.word }))
    const generated = clg.generateLayout(input)
    const placed: PlacedWord[] = (generated.result as PlacedWord[])
      .filter(w => w.orientation !== 'none')
    return { placed, rows: generated.rows as number, cols: generated.cols as number }
  }, [words])

  const [entries, setEntries] = useState<Record<string, string>>({})
  const [checked, setChecked] = useState(false)

  /** Cells that belong to a placed word, keyed "row,col". */
  const cells = useMemo(() => {
    const map = new Map<string, { answer: string; number?: number }>()
    for (const word of layout.placed) {
      for (let i = 0; i < word.answer.length; i++) {
        const row = word.starty - 1 + (word.orientation === 'down' ? i : 0)
        const col = word.startx - 1 + (word.orientation === 'across' ? i : 0)
        const key = `${row},${col}`
        map.set(key, {
          answer: word.answer[i].toUpperCase(),
          number: i === 0 ? word.position : map.get(key)?.number,
        })
      }
    }
    return map
  }, [layout])

  const allCorrect =
    cells.size > 0 &&
    Array.from(cells.entries()).every(([key, cell]) => entries[key]?.toUpperCase() === cell.answer)

  if (layout.placed.length === 0) {
    return (
      <Card className="mx-auto max-w-md">
        <CardContent className="text-center">
          <h2 className="mb-2 font-fredoka text-2xl font-bold">These words won&apos;t fit together</h2>
          <p className="font-nunito text-muted-foreground">
            Crosswords need words that share letters. Look up a few more and try again.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="mx-auto max-w-4xl">
      {/* The grid scrolls inside its own container so the page body never
          scrolls sideways on a phone. */}
      <div className="mb-6 overflow-x-auto">
        <div
          className="grid gap-0.5"
          style={{
            gridTemplateColumns: `repeat(${layout.cols}, minmax(2.25rem, 2.75rem))`,
            width: 'max-content',
          }}
        >
          {Array.from({ length: layout.rows * layout.cols }, (_, i) => {
            const row = Math.floor(i / layout.cols)
            const col = i % layout.cols
            const key = `${row},${col}`
            const cell = cells.get(key)

            if (!cell) return <div key={key} aria-hidden="true" />

            const value = entries[key] ?? ''
            const correct = checked && value.toUpperCase() === cell.answer
            const wrong = checked && value !== '' && !correct

            return (
              <div key={key} className="relative">
                {cell.number && (
                  <span className="absolute left-0.5 top-0 z-10 font-nunito text-[0.6rem] font-bold text-muted-foreground">
                    {cell.number}
                  </span>
                )}
                <input
                  type="text"
                  maxLength={1}
                  value={value}
                  aria-label={`Row ${row + 1}, column ${col + 1}`}
                  onChange={e =>
                    setEntries(prev => ({ ...prev, [key]: e.target.value.toUpperCase() }))
                  }
                  className={[
                    'aspect-square w-full rounded-sm border-2 text-center font-fredoka text-lg uppercase',
                    'focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/40',
                    correct ? 'border-mint bg-mint/20'
                      : wrong ? 'border-coral bg-coral/20'
                      : 'border-border bg-card',
                  ].join(' ')}
                />
              </div>
            )
          })}
        </div>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Button variant="playful" onClick={() => setChecked(true)}>Check my answers</Button>
        <Button variant="outline" onClick={() => { setEntries({}); setChecked(false) }}>
          Start over
        </Button>
        {checked && allCorrect && (
          <p className="font-fredoka text-xl font-bold text-primary animate-pop">
            You solved it!
          </p>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {(['across', 'down'] as const).map(direction => (
          <div key={direction}>
            <h2 className="mb-2 font-fredoka text-xl font-bold capitalize">{direction}</h2>
            <ol className="space-y-2">
              {layout.placed
                .filter(w => w.orientation === direction)
                .sort((a, b) => a.position - b.position)
                .map(word => (
                  <li key={`${direction}-${word.position}`} className="font-nunito">
                    <span className="font-bold">{word.position}.</span> {word.clue}
                  </li>
                ))}
            </ol>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Write the crossword page**

Replace `src/app/games/crossword/page.tsx`:

```tsx
'use client'

import { config } from '@/config'
import { useWordStore } from '@/hooks/useWordStore'
import { CrosswordGame } from '@/components/games/CrosswordGame'
import { NotEnoughWords } from '@/components/games/NotEnoughWords'

/** Client-only: the layout is generated in the browser from localStorage. */
export default function CrosswordPage() {
  const { words, loading } = useWordStore()

  return (
    <main className="container mx-auto px-4 py-8">
      <h1 className="mb-8 text-center font-fredoka text-3xl font-bold md:text-4xl">
        Word Crossword
      </h1>

      {loading ? (
        <p className="text-center font-nunito text-muted-foreground">Loading your words...</p>
      ) : words.length < config.games.minWordsRequired ? (
        <NotEnoughWords have={words.length} />
      ) : (
        <CrosswordGame words={words} />
      )}
    </main>
  )
}
```

- [ ] **Step 3: Look at it in a browser**

`npm run dev`, then `/games/crossword` with several words saved.

Check: the grid renders with clue numbers; typing fills cells; "Check my answers" turns correct cells mint and wrong ones coral; "Start over" clears; clues are listed under Across and Down. On a 390px screenshot the grid scrolls **inside its container** while the page body does not scroll sideways. **No console errors.**

- [ ] **Step 4: Full build and suite**

Run: `npm run build`
Expected: succeeds with no type errors. Any remaining reference to a deleted module is a bug to fix now.

Run: `npm test`
Expected: every suite passes.

- [ ] **Step 5: Commit**

```bash
git add src/app/games/crossword src/components/games/CrosswordGame.tsx
git commit -m "feat: rebuild the crossword to generate from localStorage

Layout is generated in the browser from the saved collection. Words the
generator cannot place are filtered out rather than treated as an error —
with a small or awkward set some will not fit, and a partial crossword is
still playable.

The grid scrolls inside its own container so the page body never scrolls
sideways on a phone."
```

---

## Task 15: Playwright smoke suite

Deliberately few specs. They catch integration breakage that unit tests structurally cannot see: a blank render, a client/server boundary violation, a hydration mismatch.

**Files:**
- Create: `e2e/fixtures.ts`, `e2e/word-lookup.spec.ts`, `e2e/collection.spec.ts`, `e2e/games.spec.ts`

**Interfaces:**
- Consumes: the running application
- Produces: `npm run test:e2e` passing

- [ ] **Step 1: Write the fixtures**

`e2e/fixtures.ts`:

```ts
import type { Page } from '@playwright/test'

/**
 * Seeds the collection directly rather than by looking words up.
 *
 * Real lookups take around ten seconds each and consume AI quota, so specs
 * that test the collection, the quiz or the crossword write to localStorage
 * instead. Only the lookup spec exercises the pipeline.
 */
export async function seedWords(page: Page, count: number) {
  const words = Array.from({ length: count }, (_, i) => ({
    word: `testword${i}`,
    definition: `This is what testword${i} means.`,
    partOfSpeech: 'noun',
    examples: [`Here is testword${i} in a sentence.`],
    synonyms: [],
    phonetic: null,
    comicImageUrl: null,
    ageGroup: '4-6',
    textVersion: 1,
    addedAt: new Date(Date.now() - i * 1000).toISOString(),
  }))

  // A page must be loaded before localStorage is reachable for this origin.
  await page.goto('/')
  await page.evaluate(
    ([key, value]) => localStorage.setItem(key as string, value as string),
    ['kd.words.v1', JSON.stringify(words)],
  )
}

/** Fails a spec on any console error — this is the point of the suite. */
export function failOnConsoleErrors(page: Page, errors: string[]) {
  page.on('console', message => {
    if (message.type() === 'error') errors.push(message.text())
  })
  page.on('pageerror', error => errors.push(error.message))
}
```

- [ ] **Step 2: Write the lookup spec**

`e2e/word-lookup.spec.ts`:

```ts
import { test, expect } from '@playwright/test'
import { failOnConsoleErrors } from './fixtures'

test.describe('word lookup', () => {
  test('searching a word shows its definition and saves it', async ({ page }) => {
    const errors: string[] = []
    failOnConsoleErrors(page, errors)

    await page.goto('/')
    await page.getByLabel('Search for a word').fill('enormous')
    await page.getByRole('button', { name: 'Look up' }).click()

    // Generous: a cache miss runs two model calls plus image compression.
    await expect(page.getByRole('heading', { name: 'enormous' }))
      .toBeVisible({ timeout: 60_000 })

    const definition = page.locator('main')
    await expect(definition).toContainText(/\w+/)

    await expect(page.getByText('Saved to My Words')).toBeVisible()

    const stored = await page.evaluate(() => localStorage.getItem('kd.words.v1'))
    expect(stored).toContain('enormous')

    expect(errors).toEqual([])
  })

  test('an unknown word shows the friendly message', async ({ page }) => {
    await page.goto('/search/qwertyuiopasdf')
    await expect(page.getByText(/don't know that word/i)).toBeVisible({ timeout: 30_000 })
  })
})
```

- [ ] **Step 3: Write the collection spec**

`e2e/collection.spec.ts`:

```ts
import { test, expect } from '@playwright/test'
import { seedWords, failOnConsoleErrors } from './fixtures'

test.describe('the collection', () => {
  test('saved words survive a reload', async ({ page }) => {
    // The core promise of localStorage persistence. If this breaks, a child
    // loses their collection on every visit.
    const errors: string[] = []
    failOnConsoleErrors(page, errors)

    await seedWords(page, 5)
    await page.goto('/dictionary')
    await expect(page.getByRole('link', { name: 'testword0' })).toBeVisible()

    await page.reload()
    await expect(page.getByRole('link', { name: 'testword0' })).toBeVisible()

    expect(errors).toEqual([])
  })

  test('an empty collection shows the empty state, not a blank page', async ({ page }) => {
    await page.goto('/')
    await page.evaluate(() => localStorage.clear())
    await page.goto('/dictionary')
    await expect(page.getByRole('heading', { name: 'No words yet' })).toBeVisible()
  })

  test('a correct answer removes a word and a cancel keeps it', async ({ page }) => {
    await seedWords(page, 5)
    await page.goto('/dictionary')

    await page.getByRole('button', { name: 'Remove testword0' }).click()
    await expect(page.getByRole('heading', { name: 'One last question!' })).toBeVisible()

    await page.getByRole('button', { name: 'Cancel, keep this word' }).click()
    await expect(page.getByRole('link', { name: 'testword0' })).toBeVisible()

    await page.getByRole('button', { name: 'Remove testword0' }).click()
    // Seeded definitions are unique per word, so the correct choice is
    // identifiable without reading component state.
    await page.getByRole('button', { name: 'This is what testword0 means.' }).click()

    await expect(page.getByRole('link', { name: 'testword0' })).toHaveCount(0)
    await page.reload()
    await expect(page.getByRole('link', { name: 'testword0' })).toHaveCount(0)
  })
})
```

- [ ] **Step 4: Write the games spec**

`e2e/games.spec.ts`:

```ts
import { test, expect } from '@playwright/test'
import { seedWords, failOnConsoleErrors } from './fixtures'

test.describe('games', () => {
  test('both games gate below the minimum collection size', async ({ page }) => {
    await seedWords(page, 2)

    await page.goto('/games/quiz')
    await expect(page.getByRole('heading', { name: 'Almost ready!' })).toBeVisible()

    await page.goto('/games/crossword')
    await expect(page.getByRole('heading', { name: 'Almost ready!' })).toBeVisible()
  })

  test('a quiz round plays to a score at exactly the minimum', async ({ page }) => {
    // Four words is the boundary case: it yields exactly the three wrong
    // answers a four-choice question needs.
    const errors: string[] = []
    failOnConsoleErrors(page, errors)

    await seedWords(page, 4)
    await page.goto('/games/quiz')

    await expect(page.getByText('Question 1 of 4')).toBeVisible()

    for (let i = 0; i < 4; i++) {
      await page.locator('main button').filter({ hasNotText: /Next|See my score/ }).first().click()
      await page.getByRole('button', { name: /Next|See my score/ }).click()
    }

    await expect(page.getByText(/out of 4/)).toBeVisible()
    expect(errors).toEqual([])
  })

  test('the crossword renders a grid and clues', async ({ page }) => {
    const errors: string[] = []
    failOnConsoleErrors(page, errors)

    await seedWords(page, 6)
    await page.goto('/games/crossword')

    await expect(page.getByRole('button', { name: 'Check my answers' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Across' })).toBeVisible()
    expect(errors).toEqual([])
  })
})
```

- [ ] **Step 5: Run the suite**

Run: `npm run test:e2e`
Expected: all specs pass. The lookup spec is slow on a cold cache; the rest are fast.

- [ ] **Step 6: Commit**

```bash
git add e2e playwright.config.ts
git commit -m "test: add the Playwright smoke suite

Five specs covering what unit tests structurally cannot see: a blank
render, a client/server boundary violation, a hydration mismatch. Every
spec asserts an empty console, which is the main thing being checked.

Collection and game specs seed localStorage directly rather than looking
words up, since a real lookup takes around ten seconds and consumes AI
quota. Only the lookup spec exercises the pipeline."
```

---

## Task 16: Final verification and documentation

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Verify the whole build**

```bash
npm run build && npm test && npm run test:e2e
```

All three must pass. Fix anything that does not before continuing.

- [ ] **Step 2: Check for orphaned references**

```bash
grep -rn "replicate\|anthropic\|@/lib/claude\|user_words\|profiles\|UserWord\|pronunciationUrl\|supabase/client\|middleware" src/ --include="*.ts" --include="*.tsx"
```

Expected: no matches. Each one is a leftover from the previous architecture.

- [ ] **Step 3: Confirm no secret reaches the browser**

```bash
grep -rn "SERVICE_ROLE\|GOOGLE_AI_API_KEY\|OPENROUTER_API_KEY" src/
```

Expected: matches only in `src/lib/supabase/server.ts`, `src/lib/ai/index.ts`, and `src/config.ts`. **A match in any file marked `'use client'` is a credential leak — stop and fix it.**

- [ ] **Step 4: Walk the whole app in a browser**

With a clean localStorage, drive Playwright through: landing → look up four words → collection shows four → quiz plays to a score → crossword renders → remove a word via the quiz → reload and confirm it stayed removed.

Screenshot each page at 390px and 1280px. Confirm no horizontal body scroll anywhere and no console errors throughout.

- [ ] **Step 5: Rewrite the README**

`README.md`:

````markdown
# Kids Dictionary

A word lookup app for children aged 4–10. Each word gets a simplified
definition, examples, synonyms, and an AI-generated comic strip. Words are
collected automatically and reinforced with a quiz and a crossword.

## Running it

```bash
npm install
cp .env.example .env.local   # then fill in the values below
npm run dev
```

## Environment

| Variable | Where to get it |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API. **Server-only.** |
| `AI_PROVIDER` | `gemini` or `qwen` |
| `GOOGLE_AI_API_KEY` | https://aistudio.google.com/apikey |
| `OPENROUTER_API_KEY` | https://openrouter.ai/keys — only for `qwen` |

## Supabase setup

Under **Settings → API → Security**: Data API **on**, automatically expose new
tables **off**, automatic RLS **on**.

Create a **public** Storage bucket named `comics`, then run
`supabase/migrations/002_revamp_schema.sql` in the SQL editor.

## Testing

```bash
npm test           # unit
npm run test:e2e   # browser
```

## How it works

There are no accounts. A user's collection lives in their browser's
localStorage; Supabase holds only a shared cache of generated words, so each
word is produced once for everyone rather than once per visitor.

There is exactly one API route, `GET /api/word/[word]`. It exists because the
browser cannot hold the AI or service-role keys and cannot run sharp.
Everything else — saving, reading the collection, both games — runs
client-side.

See `docs/superpowers/specs/2026-07-28-kid-dictionary-revamp-design.md` for
the design decisions and why they were made.
````

- [ ] **Step 6: Commit**

```bash
git add README.md
git commit -m "docs: rewrite the README for the revamped architecture

Covers the environment variables, the required Supabase project settings,
and why there is only one API route."
```

---

## Self-review notes

Checked against the spec:

- **§2.1a age group** — Task 4 (`useAgeGroup`, header toggle)
- **§4.1 WordStore** — Task 3
- **§4.2 ImageStore** — Task 7
- **§4.3 providers** — Task 6
- **§4.4 prompts** — Task 6
- **§4.5 safety** — Task 5, wired into the pipeline in Task 8
- **§5 data model** — Task 7
- **§6 pipeline and degradation** — Task 8
- **§7 design system** — Task 2 (tokens), Task 4 (components)
- **§8 pages** — Tasks 9, 10, 12, 13, 14
- **§8.1 local-only games** — Tasks 11, 13, 14
- **§9 config** — Task 2
- **§10 testing** — throughout, plus Task 15
- **§10.2 build order** — the task order is the build order
- **§11 removals** — Task 1, verified in Task 16

**Deferred, and deliberately so:**

- **Framer Motion** is still a dependency but unused — the CSS animations in
  `globals.css` cover everything the design needs. Removing it is a one-line
  change once that is confirmed at the end of Task 16.
- **The localStorage refresh loop** for stale `textVersion` entries is not
  built. The field is stamped so it can be added later without a blind
  regeneration, which was the part that could not be retrofitted.
- **Orphaned image cleanup** after a version bump has no script.

**Known type-safety gap:** `crossword-layout-generator` ships no type
declarations, so `CrosswordGame` uses a `@ts-ignore` on the import and hand-
written types for its output. That is contained to one file.

