# Kids Dictionary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a kids' dictionary web app (ages 4–10) where children search words and see a comic storybook with narration, simplified definition, pronunciation, examples, and synonyms — plus a personal dictionary and MCQ quiz/crossword games.

**Architecture:** Next.js App Router with API routes as the backend. Supabase handles auth, Postgres, and file storage. Word data is fetched from the free Dictionary API, enriched by Claude Haiku, and illustrated with a Flux-generated comic strip — all cached per `(word, age_group)` so each pair is generated once ever.

**Tech Stack:** Next.js 14 (App Router), TypeScript, Tailwind CSS, Supabase, @anthropic-ai/sdk, replicate, framer-motion, crossword-layout-generator, Vitest

**Spec:** `docs/superpowers/specs/2026-04-09-kids-dictionary-design.md`

---

## File Map

```
kid-dictionary/
├── src/
│   ├── config.ts                              # All tuneable constants
│   ├── types.ts                               # Shared TypeScript types
│   ├── middleware.ts                           # Auth guards for protected routes
│   ├── app/
│   │   ├── layout.tsx                         # Root layout: fonts, Supabase provider
│   │   ├── globals.css                        # Tailwind base styles
│   │   ├── page.tsx                           # Landing page with search bar
│   │   ├── auth/
│   │   │   ├── callback/route.ts              # Supabase Auth redirect handler
│   │   │   ├── signin/page.tsx                # Sign-in form
│   │   │   └── signup/page.tsx                # Sign-up form (includes age group)
│   │   ├── search/[word]/page.tsx             # Word page: dictionary + comic
│   │   ├── dictionary/page.tsx                # Personal saved word list
│   │   ├── games/
│   │   │   ├── page.tsx                       # Game hub
│   │   │   ├── quiz/page.tsx                  # MCQ quiz
│   │   │   └── crossword/page.tsx             # Crossword puzzle
│   │   └── api/
│   │       ├── word/[word]/route.ts           # GET word data (core pipeline)
│   │       ├── word/save/route.ts             # POST save word to dictionary
│   │       ├── dictionary/route.ts            # GET user's saved words
│   │       └── games/
│   │           ├── quiz/route.ts              # GET MCQ questions
│   │           └── crossword/route.ts         # GET words for crossword
│   ├── components/
│   │   ├── SearchBar.tsx                      # Search input + submit
│   │   ├── DictionaryEntry.tsx                # Word header, definition, examples, synonyms
│   │   ├── ComicStorybook.tsx                 # Comic image + panel highlight + narration
│   │   ├── AddToDictionaryButton.tsx          # Save button with auth gate
│   │   ├── WordCard.tsx                       # Card for saved word in dictionary list
│   │   └── games/
│   │       ├── QuizGame.tsx                   # MCQ game UI
│   │       └── CrosswordGame.tsx              # Crossword UI
│   └── lib/
│       ├── supabase/
│       │   ├── client.ts                      # Browser Supabase client
│       │   └── server.ts                      # Server Supabase client (API routes + server components)
│       ├── dictionary-api.ts                  # api.dictionaryapi.dev client
│       ├── claude.ts                          # Claude prompts: enrichment + story
│       ├── replicate.ts                       # Flux comic strip generation
│       ├── word-pipeline.ts                   # Shared word lookup/generation logic (used by API route + word page)
│       └── quiz.ts                            # Pure quiz question generation logic
├── supabase/
│   └── migrations/
│       └── 001_initial_schema.sql
├── src/__tests__/
│   ├── lib/dictionary-api.test.ts
│   ├── lib/claude.test.ts
│   ├── lib/replicate.test.ts
│   └── api/quiz.test.ts
├── vitest.config.ts
├── tailwind.config.ts
├── .env.local                                 # API keys (never committed)
├── .env.example                               # Template for required env vars
├── CLAUDE.md
└── package.json
```

---

## Task 1: Project Scaffold

**Files:**
- Create: `package.json` (via create-next-app)
- Create: `vitest.config.ts`
- Create: `.env.example`
- Create: `CLAUDE.md`

> **Context for the worker:** The `kid-dictionary` directory already exists at the project root with a `docs/` subdirectory inside. Run all commands from within that directory. Do NOT run `create-next-app kid-dictionary` — instead cd into the directory and run `create-next-app .`.

- [ ] **Step 1: Scaffold Next.js project**

```bash
cd "C:/Users/jinji/Documents/vibe projects/kid-dictionary"
npx create-next-app@14 . --typescript --tailwind --eslint --app --src-dir --turbopack --import-alias "@/*" --yes
```

> **Why pin to v14?** Next.js 15 changed `params` to be async (requires `await params`). Pinning to v14 keeps params synchronous and matches this plan's code exactly.

Expected: Next.js project scaffolded. You'll see files like `src/app/layout.tsx`, `tailwind.config.ts`, `package.json` created.

- [ ] **Step 2: Install additional dependencies**

```bash
npm install @supabase/supabase-js @supabase/ssr @anthropic-ai/sdk replicate framer-motion crossword-layout-generator
npm install -D vitest @vitejs/plugin-react @vitest/coverage-v8
```

- [ ] **Step 3: Create vitest config**

Create `vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    globals: true,
    setupFiles: [],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

- [ ] **Step 4: Add test script to package.json**

In `package.json`, add to the `"scripts"` section:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 5: Create .env.example**

Create `.env.example`:
```
# Supabase (get from https://supabase.com → your project → Settings → API)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# Anthropic Claude (get from https://console.anthropic.com)
ANTHROPIC_API_KEY=your_anthropic_api_key

# Replicate (get from https://replicate.com/account/api-tokens)
REPLICATE_API_TOKEN=your_replicate_api_token
```

- [ ] **Step 6: Copy .env.example to .env.local and fill in real values**

```bash
cp .env.example .env.local
```

Then open `.env.local` and replace the placeholder values with your real API keys.

- [ ] **Step 7: Create CLAUDE.md**

Create `CLAUDE.md` at the project root:
```markdown
# Kids Dictionary — Project Context

## What this is
A web app for kids aged 4–10 to look up words. Each word gets:
- A simplified kid-friendly definition, pronunciation, examples, synonyms
- An AI-generated comic strip storybook with narration
- A personal dictionary + MCQ quiz and crossword games

## Tech stack
- **Frontend + Backend:** Next.js 14 App Router (`src/app/`)
- **Auth + DB + Storage:** Supabase
- **AI story generation:** Claude Haiku via @anthropic-ai/sdk
- **Comic image generation:** Flux via Replicate
- **Styling:** Tailwind CSS + Framer Motion

## Critical architecture decisions

### Word caching
Every word lookup is cached in the `words` Supabase table, keyed by `(word, age_group)`.
Claude and Replicate are ONLY called when a word+age_group has never been looked up before.
Never bypass this cache.

### Age groups
- `'4-6'` = young readers (3 comic panels, simple language)
- `'7-10'` = older readers (5 comic panels, richer language)
Guest users default to `'4-6'`.

### Auth boundaries
- Public routes: `/`, `/search/[word]`, `/auth/*`
- Protected routes (require login): `/dictionary`, `/games/*`

### Config
ALL tuneable values (model names, scene counts, game settings) live in `src/config.ts`.
Do NOT hardcode these values anywhere else.

### Supabase clients
- Browser components → `src/lib/supabase/client.ts`
- Server components and API routes → `src/lib/supabase/server.ts`
Never use the browser client in server-side code.

## Do NOT change without discussion
- The `words` table schema (adding columns is fine, changing types is not)
- The age group labels `'4-6'` and `'7-10'` (used as DB enum values)
- The word generation pipeline order in `src/app/api/word/[word]/route.ts`
```

- [ ] **Step 8: Commit**

```bash
git init
git add -A
git commit -m "feat: scaffold Next.js project with dependencies"
```

---

## Task 2: Config and Types

**Files:**
- Create: `src/config.ts`
- Create: `src/types.ts`

- [ ] **Step 1: Write the test**

Create `src/__tests__/config.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { config, getAgeGroupConfig } from '@/config'

describe('config', () => {
  it('has valid age group labels', () => {
    expect(config.ageGroups.young.label).toBe('4-6')
    expect(config.ageGroups.older.label).toBe('7-10')
  })

  it('getAgeGroupConfig returns young for 4-6', () => {
    expect(getAgeGroupConfig('4-6')).toEqual(config.ageGroups.young)
  })

  it('getAgeGroupConfig returns older for 7-10', () => {
    expect(getAgeGroupConfig('7-10')).toEqual(config.ageGroups.older)
  })

  it('getAgeGroupConfig defaults to young for unknown input', () => {
    expect(getAgeGroupConfig('unknown' as any)).toEqual(config.ageGroups.young)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- src/__tests__/config.test.ts
```
Expected: FAIL — `Cannot find module '@/config'`

- [ ] **Step 3: Create src/config.ts**

```ts
export type AgeGroup = '4-6' | '7-10'

export const config = {
  ageGroups: {
    young: { label: '4-6' as AgeGroup, sceneCount: 3 },
    older: { label: '7-10' as AgeGroup, sceneCount: 5 },
  },
  ai: {
    model: 'claude-haiku-4-5-20251001',
    imageModel: 'black-forest-labs/flux-schnell',
  },
  games: {
    minWordsRequired: 4,
    mcqChoices: 4,
    quizQuestionCount: 10,
  },
  word: {
    maxInputLength: 50,
    maxSynonyms: 4,
  },
} as const

export function getAgeGroupConfig(ageGroup: AgeGroup) {
  return ageGroup === '7-10' ? config.ageGroups.older : config.ageGroups.young
}
```

- [ ] **Step 4: Create src/types.ts**

```ts
import type { AgeGroup } from '@/config'

export type { AgeGroup }

export type Scene = {
  scene: number  // 1-indexed panel number
  text: string   // narration text for this panel
}

export type WordData = {
  id: string
  word: string
  ageGroup: AgeGroup
  definition: string
  examples: string[]
  synonyms: string[]
  phonetic: string | null
  pronunciationUrl: string | null
  storyScript: Scene[]
  comicImageUrl: string | null
}

export type UserWord = {
  id: string           // user_words.id
  wordId: string       // words.id
  word: string
  definition: string
  examples: string[]
  synonyms: string[]
  phonetic: string | null
  pronunciationUrl: string | null
  comicImageUrl: string | null
  addedAt: string      // ISO timestamp
}

export type QuizQuestion = {
  mode: 'word-to-meaning' | 'meaning-to-word'
  prompt: string       // the word or definition shown
  choices: string[]    // 4 options
  answerIndex: number  // index of correct choice
}

export type DictionaryApiResult = {
  phonetic: string | null
  pronunciationUrl: string | null
  rawDefinition: string
  synonyms: string[]
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
npm test -- src/__tests__/config.test.ts
```
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/config.ts src/types.ts src/__tests__/config.test.ts
git commit -m "feat: add config and shared types"
```

---

## Task 3: Database Schema

**Files:**
- Create: `supabase/migrations/001_initial_schema.sql`

> **Context:** You need a Supabase account and project. Go to https://supabase.com, create a free account, create a new project, and note your Project URL and anon key for `.env.local`.

- [ ] **Step 1: Create migration file**

Create `supabase/migrations/001_initial_schema.sql`:
```sql
-- profiles: extends Supabase auth.users with age_group
create table public.profiles (
  id         uuid references auth.users(id) on delete cascade primary key,
  age_group  text not null check (age_group in ('4-6', '7-10')),
  created_at timestamptz default now()
);

-- Automatically create a profile row when a user signs up
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, age_group)
  values (new.id, coalesce(new.raw_user_meta_data->>'age_group', '4-6'));
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- words: global cache keyed by (word, age_group)
create table public.words (
  id                uuid primary key default gen_random_uuid(),
  word              text not null,
  age_group         text not null check (age_group in ('4-6', '7-10')),
  definition        text not null,
  examples          jsonb not null default '[]',
  synonyms          jsonb not null default '[]',
  phonetic          text,
  pronunciation_url text,
  story_script      jsonb not null default '[]',
  comic_image_url   text,
  created_at        timestamptz default now(),
  unique (word, age_group)
);

-- user_words: personal dictionary
create table public.user_words (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references public.profiles(id) on delete cascade,
  word_id    uuid references public.words(id) on delete cascade,
  added_at   timestamptz default now(),
  unique (user_id, word_id)
);

-- Row Level Security
alter table public.profiles enable row level security;
alter table public.words enable row level security;
alter table public.user_words enable row level security;

-- profiles: users can only read/update their own profile
create policy "Users can view own profile" on public.profiles
  for select using (auth.uid() = id);
create policy "Users can update own profile" on public.profiles
  for update using (auth.uid() = id);

-- words: anyone can read (public cache), only service role can insert/update
create policy "Words are publicly readable" on public.words
  for select using (true);

-- user_words: users manage their own dictionary
create policy "Users can view own words" on public.user_words
  for select using (auth.uid() = user_id);
create policy "Users can add own words" on public.user_words
  for insert with check (auth.uid() = user_id);
```

- [ ] **Step 2: Apply migration in Supabase Dashboard**

Go to your Supabase project → SQL Editor → paste the contents of `supabase/migrations/001_initial_schema.sql` → click Run.

Verify: go to Table Editor and confirm `profiles`, `words`, and `user_words` tables exist.

- [ ] **Step 3: Enable Supabase Storage bucket for comic images**

In Supabase Dashboard → Storage → New bucket:
- Name: `comic-images`
- Public: YES (images are served publicly)

- [ ] **Step 4: Commit**

```bash
git add supabase/
git commit -m "feat: add database schema and storage bucket setup"
```

---

## Task 4: Supabase Clients

**Files:**
- Create: `src/lib/supabase/client.ts`
- Create: `src/lib/supabase/server.ts`

> **Context:** Next.js App Router has two execution environments: the browser (client components) and the server (server components, API routes). Supabase needs a different client for each because the server client reads auth tokens from HTTP cookies, while the browser client uses localStorage. Always use the server client in `route.ts` files and server components.

- [ ] **Step 1: Create browser client**

Create `src/lib/supabase/client.ts`:
```ts
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

- [ ] **Step 2: Create server client**

Create `src/lib/supabase/server.ts`:
```ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // setAll called from a Server Component — safe to ignore
          }
        },
      },
    }
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/supabase/
git commit -m "feat: add Supabase browser and server clients"
```

---

## Task 5: Auth Pages and Middleware

**Files:**
- Create: `src/app/auth/callback/route.ts`
- Create: `src/app/auth/signin/page.tsx`
- Create: `src/app/auth/signup/page.tsx`
- Create: `src/middleware.ts`

> **Context:** Supabase handles authentication. Sign-up and sign-in are done via Supabase's email/password auth. After OAuth or magic-link flows, Supabase redirects to `/auth/callback` to exchange the code for a session. The middleware protects `/dictionary` and `/games/*` routes — unauthenticated users are redirected to `/auth/signin`.

- [ ] **Step 1: Create auth callback route**

Create `src/app/auth/callback/route.ts`:
```ts
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  if (code) {
    const supabase = await createClient()
    await supabase.auth.exchangeCodeForSession(code)
  }

  return NextResponse.redirect(`${origin}${next}`)
}
```

- [ ] **Step 2: Create sign-in page**

Create `src/app/auth/signin/page.tsx`:
```tsx
'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function SignInPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      router.push('/')
      router.refresh()
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-yellow-50 p-4">
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-lg p-8">
        <h1 className="font-fredoka text-3xl text-center text-orange-500 mb-6">Welcome back!</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            className="w-full rounded-2xl border-2 border-yellow-200 px-4 py-3 font-nunito text-lg focus:border-orange-400 focus:outline-none"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            className="w-full rounded-2xl border-2 border-yellow-200 px-4 py-3 font-nunito text-lg focus:border-orange-400 focus:outline-none"
          />
          {error && <p className="text-red-500 font-nunito text-sm">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-orange-400 hover:bg-orange-500 text-white font-fredoka text-xl rounded-2xl py-3 transition-colors disabled:opacity-50"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
        <p className="text-center font-nunito text-gray-500 mt-4">
          No account?{' '}
          <Link href="/auth/signup" className="text-orange-400 hover:underline">Sign up</Link>
        </p>
      </div>
    </main>
  )
}
```

- [ ] **Step 3: Create sign-up page**

Create `src/app/auth/signup/page.tsx`:
```tsx
'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { AgeGroup } from '@/types'

export default function SignUpPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [ageGroup, setAgeGroup] = useState<AgeGroup>('4-6')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { age_group: ageGroup } },
    })
    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      router.push('/')
      router.refresh()
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-yellow-50 p-4">
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-lg p-8">
        <h1 className="font-fredoka text-3xl text-center text-orange-500 mb-2">Join the fun!</h1>
        <p className="font-nunito text-center text-gray-500 mb-6">Create your word adventure</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            className="w-full rounded-2xl border-2 border-yellow-200 px-4 py-3 font-nunito text-lg focus:border-orange-400 focus:outline-none"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            className="w-full rounded-2xl border-2 border-yellow-200 px-4 py-3 font-nunito text-lg focus:border-orange-400 focus:outline-none"
          />
          <div>
            <p className="font-nunito text-gray-600 mb-2">How old are you?</p>
            <div className="grid grid-cols-2 gap-3">
              {(['4-6', '7-10'] as AgeGroup[]).map(group => (
                <button
                  key={group}
                  type="button"
                  onClick={() => setAgeGroup(group)}
                  className={`rounded-2xl py-3 font-fredoka text-lg border-2 transition-colors ${
                    ageGroup === group
                      ? 'bg-orange-400 text-white border-orange-400'
                      : 'border-yellow-200 text-gray-600 hover:border-orange-300'
                  }`}
                >
                  {group === '4-6' ? '4 – 6' : '7 – 10'}
                </button>
              ))}
            </div>
          </div>
          {error && <p className="text-red-500 font-nunito text-sm">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-orange-400 hover:bg-orange-500 text-white font-fredoka text-xl rounded-2xl py-3 transition-colors disabled:opacity-50"
          >
            {loading ? 'Creating account...' : 'Let\'s Go!'}
          </button>
        </form>
        <p className="text-center font-nunito text-gray-500 mt-4">
          Have an account?{' '}
          <Link href="/auth/signin" className="text-orange-400 hover:underline">Sign in</Link>
        </p>
      </div>
    </main>
  )
}
```

- [ ] **Step 4: Create middleware**

Create `src/middleware.ts`:
```ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const PROTECTED_PATHS = ['/dictionary', '/games']
const RATE_LIMIT_MAX = 20         // requests per window
const RATE_LIMIT_WINDOW_MS = 60_000 // 1 minute

// In-memory store: ip → [timestamps]. Works per-instance; acceptable for MVP.
const ipRequestLog = new Map<string, number[]>()

function isRateLimited(ip: string): boolean {
  const now = Date.now()
  const timestamps = (ipRequestLog.get(ip) ?? []).filter(t => now - t < RATE_LIMIT_WINDOW_MS)
  timestamps.push(now)
  ipRequestLog.set(ip, timestamps)
  return timestamps.length > RATE_LIMIT_MAX
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const isProtected = PROTECTED_PATHS.some(path => pathname.startsWith(path))

  // Rate-limit word lookup endpoint
  if (pathname.startsWith('/api/word/') && !pathname.startsWith('/api/word/save')) {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
    if (isRateLimited(ip)) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
    }
  }

  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  if (isProtected && !user) {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = '/auth/signin'
    redirectUrl.searchParams.set('next', pathname)
    return NextResponse.redirect(redirectUrl)
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
```

- [ ] **Step 5: Commit**

```bash
git add src/app/auth/ src/middleware.ts
git commit -m "feat: add auth pages and route protection middleware"
```

---

## Task 6: Global Layout and Tailwind

**Files:**
- Modify: `src/app/layout.tsx`
- Modify: `tailwind.config.ts`
- Modify: `src/app/globals.css`

- [ ] **Step 1: Update tailwind.config.ts**

Replace the content of `tailwind.config.ts`:
```ts
import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      fontFamily: {
        fredoka: ['var(--font-fredoka)', 'sans-serif'],
        nunito: ['var(--font-nunito)', 'sans-serif'],
      },
      colors: {
        brand: {
          yellow: '#FDE68A',
          orange: '#FB923C',
          green: '#4ADE80',
          blue: '#60A5FA',
          purple: '#C084FC',
        },
      },
      borderRadius: {
        '4xl': '2rem',
      },
    },
  },
  plugins: [],
}

export default config
```

- [ ] **Step 2: Update root layout**

Replace `src/app/layout.tsx`:
```tsx
import type { Metadata } from 'next'
import { Fredoka_One, Nunito } from 'next/font/google'
import './globals.css'

const fredoka = Fredoka_One({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-fredoka',
})

const nunito = Nunito({
  subsets: ['latin'],
  variable: '--font-nunito',
})

export const metadata: Metadata = {
  title: 'Word World — Kids Dictionary',
  description: 'Look up any word and see it come to life in a comic story!',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${fredoka.variable} ${nunito.variable} font-nunito bg-yellow-50 min-h-screen`}>
        {children}
      </body>
    </html>
  )
}
```

- [ ] **Step 3: Update globals.css**

Replace `src/app/globals.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  * {
    box-sizing: border-box;
  }
  body {
    -webkit-tap-highlight-color: transparent;
  }
}
```

- [ ] **Step 4: Verify dev server starts**

```bash
npm run dev
```
Open http://localhost:3000. Expected: default Next.js page loads without errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/layout.tsx tailwind.config.ts src/app/globals.css
git commit -m "feat: configure fonts, Tailwind theme, and root layout"
```

---

## Task 7: Dictionary API Client

**Files:**
- Create: `src/lib/dictionary-api.ts`
- Create: `src/__tests__/lib/dictionary-api.test.ts`

> **Context:** `api.dictionaryapi.dev` is a free, no-key-required dictionary API. We use it to: (1) validate that a word exists, (2) get the raw definition, phonetic text, pronunciation audio URL, and synonyms. All of this is passed to Claude for simplification. The API sometimes returns multiple meanings — we take the first definition from the first meaning.

- [ ] **Step 1: Write the test**

Create `src/__tests__/lib/dictionary-api.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fetchWordFromDictionaryApi } from '@/lib/dictionary-api'

const mockFetch = vi.fn()
global.fetch = mockFetch

describe('fetchWordFromDictionaryApi', () => {
  beforeEach(() => { mockFetch.mockReset() })

  it('returns null for a 404 response', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 404 })
    const result = await fetchWordFromDictionaryApi('xyzabc123')
    expect(result).toBeNull()
  })

  it('parses definition, phonetic, audio, and synonyms', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ([{
        word: 'enormous',
        phonetics: [
          { text: '/ɪˈnɔːməs/', audio: 'https://api.example.com/enormous.mp3' }
        ],
        meanings: [{
          definitions: [{ definition: 'Very large in size or quantity.', synonyms: ['huge', 'vast'] }],
          synonyms: ['gigantic']
        }]
      }])
    })
    const result = await fetchWordFromDictionaryApi('enormous')
    expect(result).not.toBeNull()
    expect(result!.rawDefinition).toBe('Very large in size or quantity.')
    expect(result!.phonetic).toBe('/ɪˈnɔːməs/')
    expect(result!.pronunciationUrl).toBe('https://api.example.com/enormous.mp3')
    expect(result!.synonyms).toContain('huge')
  })

  it('handles missing phonetic gracefully', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ([{
        word: 'test',
        phonetics: [],
        meanings: [{ definitions: [{ definition: 'A procedure.', synonyms: [] }], synonyms: [] }]
      }])
    })
    const result = await fetchWordFromDictionaryApi('test')
    expect(result!.phonetic).toBeNull()
    expect(result!.pronunciationUrl).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- src/__tests__/lib/dictionary-api.test.ts
```
Expected: FAIL — `Cannot find module '@/lib/dictionary-api'`

- [ ] **Step 3: Implement dictionary-api.ts**

Create `src/lib/dictionary-api.ts`:
```ts
import type { DictionaryApiResult } from '@/types'
import { config } from '@/config'

const API_BASE = 'https://api.dictionaryapi.dev/api/v2/entries/en'

export async function fetchWordFromDictionaryApi(
  word: string
): Promise<DictionaryApiResult | null> {
  const trimmed = word.trim().toLowerCase().slice(0, config.word.maxInputLength)
  const res = await fetch(`${API_BASE}/${encodeURIComponent(trimmed)}`)

  if (!res.ok) return null

  const data = await res.json()
  const entry = data[0]
  if (!entry) return null

  // Find first phonetic with both text and audio
  const phoneticWithAudio = entry.phonetics?.find(
    (p: any) => p.text && p.audio
  )
  const anyPhonetic = entry.phonetics?.find((p: any) => p.text)

  const phonetic = phoneticWithAudio?.text ?? anyPhonetic?.text ?? null
  const pronunciationUrl = phoneticWithAudio?.audio ?? null

  // Collect first definition
  const firstMeaning = entry.meanings?.[0]
  const rawDefinition = firstMeaning?.definitions?.[0]?.definition ?? ''

  // Collect synonyms from all meanings, up to limit
  const synonyms: string[] = []
  for (const meaning of entry.meanings ?? []) {
    synonyms.push(...(meaning.synonyms ?? []))
    for (const def of meaning.definitions ?? []) {
      synonyms.push(...(def.synonyms ?? []))
    }
  }
  const uniqueSynonyms = [...new Set(synonyms)].slice(0, config.word.maxSynonyms)

  return { phonetic, pronunciationUrl, rawDefinition, synonyms: uniqueSynonyms }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- src/__tests__/lib/dictionary-api.test.ts
```
Expected: PASS (3 tests passing)

- [ ] **Step 5: Commit**

```bash
git add src/lib/dictionary-api.ts src/__tests__/lib/dictionary-api.test.ts
git commit -m "feat: add Dictionary API client with tests"
```

---

## Task 8: Claude Client

**Files:**
- Create: `src/lib/claude.ts`
- Create: `src/__tests__/lib/claude.test.ts`

> **Context:** Claude is called for two purposes: (1) enrichment — simplifying the raw definition and generating 2 example sentences, and (2) story — generating the comic storybook script. Both return JSON. The prompts are crafted to be age-appropriate. This module only builds prompts and parses responses — it does not know about the database.

- [ ] **Step 1: Write the test**

Create `src/__tests__/lib/claude.test.ts`:
```ts
import { describe, it, expect, vi } from 'vitest'
import { buildEnrichmentPrompt, buildStoryPrompt, parseJsonResponse } from '@/lib/claude'

describe('buildEnrichmentPrompt', () => {
  it('uses simpler language for young group', () => {
    const prompt = buildEnrichmentPrompt('enormous', 'Very large in size.', '4-6')
    expect(prompt).toContain('5-year-old')
    expect(prompt).toContain('enormous')
    expect(prompt).toContain('Very large in size.')
  })

  it('uses richer language for older group', () => {
    const prompt = buildEnrichmentPrompt('enormous', 'Very large in size.', '7-10')
    expect(prompt).toContain('9-year-old')
  })
})

describe('buildStoryPrompt', () => {
  it('requests 3 scenes for young group', () => {
    const prompt = buildStoryPrompt('enormous', '4-6')
    expect(prompt).toContain('3-scene')
    expect(prompt).toContain('5-year-old')
  })

  it('requests 5 scenes for older group', () => {
    const prompt = buildStoryPrompt('enormous', '7-10')
    expect(prompt).toContain('5-scene')
    expect(prompt).toContain('9-year-old')
  })
})

describe('parseJsonResponse', () => {
  it('parses valid JSON', () => {
    const result = parseJsonResponse('{"definition": "Big.", "examples": ["The elephant was enormous."]}')
    expect(result).toEqual({ definition: 'Big.', examples: ['The elephant was enormous.'] })
  })

  it('extracts JSON from markdown code blocks', () => {
    const result = parseJsonResponse('```json\n{"definition": "Big."}\n```')
    expect(result).toEqual({ definition: 'Big.' })
  })

  it('returns null for invalid JSON', () => {
    const result = parseJsonResponse('not json at all')
    expect(result).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- src/__tests__/lib/claude.test.ts
```
Expected: FAIL

- [ ] **Step 3: Implement claude.ts**

Create `src/lib/claude.ts`:
```ts
import Anthropic from '@anthropic-ai/sdk'
import { config, getAgeGroupConfig } from '@/config'
import type { AgeGroup, Scene } from '@/types'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export function buildEnrichmentPrompt(
  word: string,
  rawDefinition: string,
  ageGroup: AgeGroup
): string {
  const isYoung = ageGroup === '4-6'
  const ageDesc = isYoung ? '5-year-old' : '9-year-old'
  const instruction = isYoung
    ? 'Simplify this definition for a 5-year-old in one short sentence using only simple words.'
    : 'Rewrite this definition clearly for a 9-year-old in one sentence.'

  return `${instruction}
Definition: "${rawDefinition}"
Then write 2 example sentences using the word "${word}" that a ${ageDesc} would understand.
Output ONLY valid JSON in this exact format: {"definition": "...", "examples": ["...", "..."]}`
}

export function buildStoryPrompt(word: string, ageGroup: AgeGroup): string {
  const { sceneCount } = getAgeGroupConfig(ageGroup)
  const isYoung = ageGroup === '4-6'
  const ageDesc = isYoung ? '5-year-old' : '9-year-old'
  const instruction = isYoung
    ? `Write a fun, silly ${sceneCount}-scene story for a ${ageDesc} using the word "${word}". Use only simple words.`
    : `Write a ${sceneCount}-scene story for a ${ageDesc} using the word "${word}". Include context that makes the meaning clear.`

  return `${instruction}
The word "${word}" must appear highlighted in at least one scene.
Output ONLY valid JSON in this exact format: [{"scene": 1, "text": "..."}, {"scene": 2, "text": "..."}]`
}

export function buildComicImagePrompt(scenes: Scene[], panelCount: number): string {
  const panelDescriptions = scenes
    .map(s => `Panel ${s.scene}: ${s.text}`)
    .join(' ')

  return `A comic strip with exactly ${panelCount} equal-width vertical panels side by side, no borders between panels, flat illustration style, bright colours, child-friendly cartoon art. ${panelDescriptions}`
}

export function parseJsonResponse(text: string): any | null {
  // Strip markdown code blocks if present
  const stripped = text.replace(/```(?:json)?\n?/g, '').replace(/```/g, '').trim()
  try {
    return JSON.parse(stripped)
  } catch {
    return null
  }
}

export async function enrichWord(
  word: string,
  rawDefinition: string,
  ageGroup: AgeGroup
): Promise<{ definition: string; examples: string[] } | null> {
  const prompt = buildEnrichmentPrompt(word, rawDefinition, ageGroup)
  try {
    const message = await anthropic.messages.create({
      model: config.ai.model,
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }],
    })
    const text = message.content[0].type === 'text' ? message.content[0].text : ''
    const parsed = parseJsonResponse(text)
    if (!parsed?.definition || !Array.isArray(parsed?.examples)) return null
    return { definition: parsed.definition, examples: parsed.examples.slice(0, 2) }
  } catch {
    return null
  }
}

export async function generateStoryScript(
  word: string,
  ageGroup: AgeGroup
): Promise<Scene[] | null> {
  const prompt = buildStoryPrompt(word, ageGroup)
  try {
    const message = await anthropic.messages.create({
      model: config.ai.model,
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }],
    })
    const text = message.content[0].type === 'text' ? message.content[0].text : ''
    const parsed = parseJsonResponse(text)
    if (!Array.isArray(parsed)) return null
    return parsed as Scene[]
  } catch {
    return null
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- src/__tests__/lib/claude.test.ts
```
Expected: PASS (5 tests passing)

- [ ] **Step 5: Commit**

```bash
git add src/lib/claude.ts src/__tests__/lib/claude.test.ts
git commit -m "feat: add Claude client with enrichment and story prompts"
```

---

## Task 9: Replicate Client

**Files:**
- Create: `src/lib/replicate.ts`
- Create: `src/__tests__/lib/replicate.test.ts`

> **Context:** Replicate runs Flux Schnell to generate the comic strip image. We upload the resulting image to Supabase Storage and store the public URL. The function returns `null` on failure — the caller treats this as a degraded-state cache entry (`comic_image_url: null`).

- [ ] **Step 1: Write the test**

Create `src/__tests__/lib/replicate.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { buildComicImagePrompt } from '@/lib/claude'

// Test the prompt builder (pure function, no API call needed)
describe('buildComicImagePrompt', () => {
  it('includes all panel descriptions', () => {
    const scenes = [
      { scene: 1, text: 'Tim finds a surprise.' },
      { scene: 2, text: 'An enormous elephant!' },
      { scene: 3, text: 'They become friends.' },
    ]
    const prompt = buildComicImagePrompt(scenes, 3)
    expect(prompt).toContain('exactly 3 equal-width vertical panels')
    expect(prompt).toContain('Panel 1: Tim finds a surprise.')
    expect(prompt).toContain('Panel 3: They become friends.')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- src/__tests__/lib/replicate.test.ts
```
Expected: FAIL — the import from `@/lib/claude` works but this test will pass once we confirm the function exists. Run it to confirm the test is correctly structured.

- [ ] **Step 3: Implement replicate.ts**

Create `src/lib/replicate.ts`:
```ts
import Replicate from 'replicate'
import { config } from '@/config'
import { createClient } from '@/lib/supabase/server'
import type { Scene } from '@/types'
import { buildComicImagePrompt } from '@/lib/claude'

const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN })

export async function generateAndStoreComicImage(
  word: string,
  ageGroup: string,
  scenes: Scene[],
  panelCount: number
): Promise<string | null> {
  try {
    const prompt = buildComicImagePrompt(scenes, panelCount)

    const output = await replicate.run(config.ai.imageModel as `${string}/${string}`, {
      input: { prompt, width: 1024, height: 512, num_outputs: 1 },
    })

    // Replicate returns an array of URLs or ReadableStreams
    const imageUrl = Array.isArray(output) ? output[0] : output
    if (!imageUrl) return null

    // Fetch the image and upload to Supabase Storage
    const imageRes = await fetch(imageUrl as string)
    if (!imageRes.ok) return null

    const blob = await imageRes.blob()
    const filename = `${word}-${ageGroup}-${Date.now()}.webp`

    const supabase = await createClient()
    const { data, error } = await supabase.storage
      .from('comic-images')
      .upload(filename, blob, { contentType: 'image/webp', upsert: false })

    if (error || !data) return null

    const { data: { publicUrl } } = supabase.storage
      .from('comic-images')
      .getPublicUrl(data.path)

    return publicUrl
  } catch {
    return null
  }
}
```

- [ ] **Step 4: Run tests**

```bash
npm test -- src/__tests__/lib/replicate.test.ts
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/replicate.ts src/__tests__/lib/replicate.test.ts
git commit -m "feat: add Replicate client for comic image generation"
```

---

## Task 10: Word Pipeline and API Route

**Files:**
- Create: `src/lib/word-pipeline.ts`
- Create: `src/app/api/word/[word]/route.ts`

> **Context:** The word lookup/generation logic lives in `src/lib/word-pipeline.ts` — a plain async function callable from both the API route AND the word page server component directly. This avoids HTTP self-calls from server components, which are fragile and require forwarding cookies. The API route is a thin wrapper around this function.

- [ ] **Step 1: Create word-pipeline.ts**

Create `src/lib/word-pipeline.ts`:
```ts
import { createClient } from '@/lib/supabase/server'
import { fetchWordFromDictionaryApi } from '@/lib/dictionary-api'
import { enrichWord, generateStoryScript } from '@/lib/claude'
import { generateAndStoreComicImage } from '@/lib/replicate'
import { getAgeGroupConfig } from '@/config'
import type { AgeGroup, WordData } from '@/types'

export type WordResult =
  | { found: false }
  | { found: true; data: WordData & { id: string | null } }

export async function lookupWord(word: string, ageGroup: AgeGroup): Promise<WordResult> {
  const supabase = await createClient()

  // 1. Check cache
  const { data: cached } = await supabase
    .from('words').select('*').eq('word', word).eq('age_group', ageGroup).single()
  if (cached) return { found: true, data: dbRowToWordData(cached) }

  // 2. Validate with dictionary API
  const dictResult = await fetchWordFromDictionaryApi(word)
  if (!dictResult) return { found: false }

  // 3. Enrich with Claude
  const enriched = await enrichWord(word, dictResult.rawDefinition, ageGroup)
  if (!enriched) {
    return {
      found: true,
      data: { id: null, word, ageGroup, definition: dictResult.rawDefinition,
               examples: [], synonyms: dictResult.synonyms,
               phonetic: dictResult.phonetic, pronunciationUrl: dictResult.pronunciationUrl,
               storyScript: [], comicImageUrl: null },
    }
  }

  // 4. Generate story script
  const storyScript = await generateStoryScript(word, ageGroup)
  if (!storyScript) {
    return {
      found: true,
      data: { id: null, word, ageGroup, definition: enriched.definition,
               examples: enriched.examples, synonyms: dictResult.synonyms,
               phonetic: dictResult.phonetic, pronunciationUrl: dictResult.pronunciationUrl,
               storyScript: [], comicImageUrl: null },
    }
  }

  // 5. Generate comic image (graceful failure)
  const { sceneCount } = getAgeGroupConfig(ageGroup)
  const comicImageUrl = await generateAndStoreComicImage(word, ageGroup, storyScript, sceneCount)

  // 6. Cache result
  const { data: inserted } = await supabase
    .from('words')
    .insert({
      word, age_group: ageGroup,
      definition: enriched.definition, examples: enriched.examples,
      synonyms: dictResult.synonyms, phonetic: dictResult.phonetic,
      pronunciation_url: dictResult.pronunciationUrl,
      story_script: storyScript, comic_image_url: comicImageUrl,
    })
    .select().single()

  if (!inserted) return { found: false }
  return { found: true, data: dbRowToWordData(inserted) }
}

export function dbRowToWordData(row: any): WordData & { id: string | null } {
  return {
    id: row.id ?? null,
    word: row.word,
    ageGroup: row.age_group,
    definition: row.definition,
    examples: row.examples ?? [],
    synonyms: row.synonyms ?? [],
    phonetic: row.phonetic ?? null,
    pronunciationUrl: row.pronunciation_url ?? null,
    storyScript: row.story_script ?? [],
    comicImageUrl: row.comic_image_url ?? null,
  }
}
```

- [ ] **Step 2: Create the API route**

Create `src/app/api/word/[word]/route.ts`:
```ts
import { NextResponse } from 'next/server'
import { lookupWord } from '@/lib/word-pipeline'
import { config } from '@/config'
import type { AgeGroup } from '@/types'

export async function GET(
  request: Request,
  { params }: { params: { word: string } }
) {
  const { searchParams } = new URL(request.url)
  const rawAgeGroup = searchParams.get('ageGroup')
  const ageGroup: AgeGroup = rawAgeGroup === '7-10' ? '7-10' : '4-6'
  const word = params.word.toLowerCase().trim().slice(0, config.word.maxInputLength)
  if (!word) return NextResponse.json({ error: 'Word is required' }, { status: 400 })

  const result = await lookupWord(word, ageGroup)
  if (!result.found) return NextResponse.json({ error: 'Word not found' }, { status: 404 })
  return NextResponse.json(result.data)
}
```

- [ ] **Step 3: Test manually in dev**

```bash
npm run dev
curl "http://localhost:3000/api/word/enormous?ageGroup=4-6"
```
Expected: JSON with word data. Test invalid word returns 404.

- [ ] **Step 4: Commit**

```bash
git add src/lib/word-pipeline.ts src/app/api/word/
git commit -m "feat: add word pipeline and API route"
```

---

## Task 11: Landing Page and Search Bar

**Files:**
- Create: `src/components/SearchBar.tsx`
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Create SearchBar component**

Create `src/components/SearchBar.tsx`:
```tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function SearchBar({ initialValue = '' }: { initialValue?: string }) {
  const [query, setQuery] = useState(initialValue)
  const router = useRouter()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const word = query.trim().toLowerCase()
    if (word) router.push(`/search/${encodeURIComponent(word)}`)
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 w-full max-w-lg">
      <input
        type="text"
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="Search a word..."
        maxLength={50}
        className="flex-1 rounded-2xl border-2 border-yellow-300 bg-white px-5 py-4 font-nunito text-xl focus:border-orange-400 focus:outline-none shadow-sm"
      />
      <button
        type="submit"
        className="bg-orange-400 hover:bg-orange-500 text-white font-fredoka text-xl rounded-2xl px-6 py-4 transition-colors shadow-sm min-w-[120px]"
      >
        Search!
      </button>
    </form>
  )
}
```

- [ ] **Step 2: Replace landing page**

Replace `src/app/page.tsx`:
```tsx
import Link from 'next/link'
import SearchBar from '@/components/SearchBar'
import { createClient } from '@/lib/supabase/server'

export default async function HomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 gap-8">
      <div className="text-center">
        <h1 className="font-fredoka text-5xl md:text-7xl text-orange-400 mb-2">
          Word World
        </h1>
        <p className="font-nunito text-xl text-gray-500">
          Search any word and watch it come to life!
        </p>
      </div>

      <SearchBar />

      <div className="flex gap-4 font-nunito text-gray-500">
        {user ? (
          <>
            <Link href="/dictionary" className="hover:text-orange-400 transition-colors">My Dictionary</Link>
            <span>·</span>
            <Link href="/games" className="hover:text-orange-400 transition-colors">Games</Link>
          </>
        ) : (
          <>
            <Link href="/auth/signin" className="hover:text-orange-400 transition-colors">Sign In</Link>
            <span>·</span>
            <Link href="/auth/signup" className="hover:text-orange-400 transition-colors">Sign Up</Link>
          </>
        )}
      </div>
    </main>
  )
}
```

- [ ] **Step 3: Verify visually**

Run `npm run dev`, open http://localhost:3000. You should see the Word World landing page with a search bar. Searching a word should navigate to `/search/[word]` (404 for now).

- [ ] **Step 4: Commit**

```bash
git add src/components/SearchBar.tsx src/app/page.tsx
git commit -m "feat: add landing page with search bar"
```

---

## Task 12: Dictionary Entry Component and Word Page

**Files:**
- Create: `src/components/DictionaryEntry.tsx`
- Create: `src/components/ComicStorybook.tsx`
- Create: `src/components/AddToDictionaryButton.tsx`
- Create: `src/app/search/[word]/page.tsx`

- [ ] **Step 1: Create DictionaryEntry component**

Create `src/components/DictionaryEntry.tsx`:
```tsx
'use client'
import { useRef } from 'react'
import Link from 'next/link'
import type { WordData } from '@/types'

export default function DictionaryEntry({ data }: { data: WordData }) {
  const audioRef = useRef<HTMLAudioElement>(null)

  return (
    <div className="space-y-6">
      {/* Word + pronunciation */}
      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="font-fredoka text-5xl text-orange-400">{data.word}</h1>
        {data.phonetic && (
          <span className="font-nunito text-lg text-gray-400">{data.phonetic}</span>
        )}
        {data.pronunciationUrl && (
          <>
            <button
              onClick={() => audioRef.current?.play()}
              className="bg-yellow-200 hover:bg-yellow-300 rounded-full p-2 transition-colors"
              aria-label="Hear pronunciation"
            >
              🔊
            </button>
            <audio ref={audioRef} src={data.pronunciationUrl} />
          </>
        )}
      </div>

      {/* Definition */}
      <div className="bg-white rounded-3xl p-6 shadow-sm border-2 border-yellow-100">
        <p className="font-nunito text-xl text-gray-700 leading-relaxed">{data.definition}</p>
      </div>

      {/* Examples */}
      {data.examples.length > 0 && (
        <div className="space-y-2">
          <h2 className="font-fredoka text-xl text-gray-500">Examples</h2>
          {data.examples.map((ex, i) => (
            <p key={i} className="font-nunito text-lg text-gray-600 italic border-l-4 border-yellow-300 pl-4">
              {ex}
            </p>
          ))}
        </div>
      )}

      {/* Synonyms */}
      {data.synonyms.length > 0 && (
        <div className="space-y-2">
          <h2 className="font-fredoka text-xl text-gray-500">Similar words</h2>
          <div className="flex flex-wrap gap-2">
            {data.synonyms.map(syn => (
              <Link
                key={syn}
                href={`/search/${encodeURIComponent(syn)}`}
                className="bg-brand-blue/20 hover:bg-brand-blue/40 text-blue-700 font-nunito text-lg rounded-2xl px-4 py-1 transition-colors"
              >
                {syn}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Create ComicStorybook component**

Create `src/components/ComicStorybook.tsx`:
```tsx
'use client'
import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Scene } from '@/types'

interface Props {
  word: string
  storyScript: Scene[]
  comicImageUrl: string | null
  panelCount: number
}

export default function ComicStorybook({ word, storyScript, comicImageUrl, panelCount }: Props) {
  const [currentScene, setCurrentScene] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null)

  function highlightWord(text: string): React.ReactNode {
    const parts = text.split(new RegExp(`(${word})`, 'gi'))
    return parts.map((part, i) =>
      part.toLowerCase() === word.toLowerCase()
        ? <strong key={i} className="text-orange-500 font-fredoka">{part}</strong>
        : part
    )
  }

  function speakScene(index: number) {
    if (!('speechSynthesis' in window)) return
    window.speechSynthesis.cancel()
    const scene = storyScript[index]
    if (!scene) return

    const utterance = new SpeechSynthesisUtterance(scene.text)
    utterance.rate = 0.85
    utterance.onend = () => {
      const next = index + 1
      if (next < storyScript.length) {
        setCurrentScene(next)
        speakScene(next)
      } else {
        setIsPlaying(false)
      }
    }
    utteranceRef.current = utterance
    window.speechSynthesis.speak(utterance)
  }

  function handlePlay() {
    setCurrentScene(0)
    setIsPlaying(true)
    speakScene(0)
  }

  function handleStop() {
    window.speechSynthesis?.cancel()
    setIsPlaying(false)
  }

  useEffect(() => () => { window.speechSynthesis?.cancel() }, [])

  if (storyScript.length === 0) return null

  const panelWidthPct = 100 / panelCount

  return (
    <div className="space-y-4">
      <h2 className="font-fredoka text-2xl text-orange-400">Story Time!</h2>

      {/* Comic strip image with panel highlight */}
      {comicImageUrl && (
        <div className="relative rounded-3xl overflow-hidden border-4 border-yellow-200 shadow-md">
          <img src={comicImageUrl} alt={`Comic strip for ${word}`} className="w-full" />
          {/* Panel highlight overlay */}
          <AnimatePresence mode="wait">
            <motion.div
              key={currentScene}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="absolute inset-y-0 border-4 border-orange-400 bg-orange-400/10 pointer-events-none rounded-sm"
              style={{
                left: `${currentScene * panelWidthPct}%`,
                width: `${panelWidthPct}%`,
              }}
            />
          </AnimatePresence>
        </div>
      )}

      {/* Current scene text */}
      <div className="bg-white rounded-3xl p-5 border-2 border-yellow-100 min-h-[80px] flex items-center">
        <p className="font-nunito text-xl text-gray-700 leading-relaxed">
          {highlightWord(storyScript[currentScene]?.text ?? '')}
        </p>
      </div>

      {/* Controls */}
      <div className="flex gap-3">
        {!isPlaying ? (
          <button
            onClick={handlePlay}
            className="bg-green-400 hover:bg-green-500 text-white font-fredoka text-xl rounded-2xl px-6 py-3 transition-colors"
          >
            ▶ Play Story
          </button>
        ) : (
          <button
            onClick={handleStop}
            className="bg-gray-300 hover:bg-gray-400 text-gray-700 font-fredoka text-xl rounded-2xl px-6 py-3 transition-colors"
          >
            ■ Stop
          </button>
        )}
        {/* Scene dots */}
        <div className="flex items-center gap-2 ml-2">
          {storyScript.map((_, i) => (
            <button
              key={i}
              onClick={() => { setCurrentScene(i); handleStop() }}
              className={`w-3 h-3 rounded-full transition-colors ${i === currentScene ? 'bg-orange-400' : 'bg-gray-300'}`}
              aria-label={`Scene ${i + 1}`}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create AddToDictionaryButton component**

Create `src/components/AddToDictionaryButton.tsx`:
```tsx
'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Props { wordId: string | null }

export default function AddToDictionaryButton({ wordId }: Props) {
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(false)
  const [user, setUser] = useState<any>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user))
  }, [])

  async function handleClick() {
    if (!user) {
      router.push('/auth/signup')
      return
    }
    if (!wordId || saved || loading) return
    setLoading(true)
    const res = await fetch('/api/word/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wordId }),
    })
    if (res.ok || res.status === 409) setSaved(true)
    setLoading(false)
  }

  if (saved) {
    return (
      <div className="bg-green-100 text-green-700 font-fredoka text-xl rounded-2xl px-6 py-3 border-2 border-green-200">
        ✓ In My Dictionary
      </div>
    )
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading || !wordId}
      className="bg-yellow-400 hover:bg-yellow-500 text-white font-fredoka text-xl rounded-2xl px-6 py-3 transition-colors disabled:opacity-50"
    >
      {loading ? 'Saving...' : user ? '+ Add to My Dictionary' : '+ Save Word (Sign Up)'}
    </button>
  )
}
```

- [ ] **Step 4: Create word page**

Create `src/app/search/[word]/page.tsx`:
```tsx
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { lookupWord } from '@/lib/word-pipeline'
import DictionaryEntry from '@/components/DictionaryEntry'
import ComicStorybook from '@/components/ComicStorybook'
import AddToDictionaryButton from '@/components/AddToDictionaryButton'
import SearchBar from '@/components/SearchBar'
import { getAgeGroupConfig, config } from '@/config'
import type { AgeGroup } from '@/types'

export default async function WordPage({ params }: { params: { word: string } }) {
  const word = decodeURIComponent(params.word).toLowerCase().trim()
    .slice(0, config.word.maxInputLength)

  // Determine age group from user profile (guests default to 4-6)
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  let ageGroup: AgeGroup = '4-6'
  if (user) {
    const { data: profile } = await supabase
      .from('profiles').select('age_group').eq('id', user.id).single()
    if (profile?.age_group) ageGroup = profile.age_group as AgeGroup
  }

  // Call pipeline directly — no HTTP self-call needed from server components
  const result = await lookupWord(word, ageGroup)
  if (!result.found) notFound()

  const data = result.data
  const { sceneCount } = getAgeGroupConfig(ageGroup)

  return (
    <main className="min-h-screen p-6 max-w-2xl mx-auto space-y-8">
      <SearchBar initialValue={word} />
      <DictionaryEntry data={data} />
      <AddToDictionaryButton wordId={data.id} />
      {data.storyScript.length > 0 && (
        <ComicStorybook
          word={word}
          storyScript={data.storyScript}
          comicImageUrl={data.comicImageUrl}
          panelCount={sceneCount}
        />
      )}
    </main>
  )
}
```

- [ ] **Step 5: Test the full word flow**

Run `npm run dev`. Search for "enormous" on the landing page. Expected:
- Word page loads with definition, phonetic, examples, synonyms
- Comic strip image appears (if Replicate key is set)
- "Play Story" button narrates the scenes
- Panel highlight moves as narration plays

- [ ] **Step 7: Commit**

```bash
git add src/components/ src/app/search/ .env.example
git commit -m "feat: add word page with dictionary entry and comic storybook"
```

---

## Task 13: Save Word API Route and Dictionary Page

**Files:**
- Create: `src/app/api/word-save/route.ts`
- Create: `src/app/api/dictionary/route.ts`
- Create: `src/components/WordCard.tsx`
- Create: `src/app/dictionary/page.tsx`

- [ ] **Step 1: Create word save API route**

Create `src/app/api/word/save/route.ts`:
```ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { wordId } = await request.json()
  if (!wordId) return NextResponse.json({ error: 'wordId required' }, { status: 400 })

  const { error } = await supabase
    .from('user_words')
    .insert({ user_id: user.id, word_id: wordId })

  if (error?.code === '23505') {
    // Unique constraint: word already saved
    return NextResponse.json({ success: true }, { status: 409 })
  }
  if (error) return NextResponse.json({ error: 'Failed to save' }, { status: 500 })

  return NextResponse.json({ success: true })
}
```

- [ ] **Step 2: Create dictionary API route**

Create `src/app/api/dictionary/route.ts`:
```ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { UserWord } from '@/types'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('user_words')
    .select(`
      id,
      added_at,
      words (
        id, word, definition, examples, synonyms,
        phonetic, pronunciation_url, comic_image_url
      )
    `)
    .eq('user_id', user.id)
    .order('added_at', { ascending: false })

  if (error) return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 })

  const words: UserWord[] = (data ?? []).map((row: any) => ({
    id: row.id,
    wordId: row.words.id,
    word: row.words.word,
    definition: row.words.definition,
    examples: row.words.examples ?? [],
    synonyms: row.words.synonyms ?? [],
    phonetic: row.words.phonetic ?? null,
    pronunciationUrl: row.words.pronunciation_url ?? null,
    comicImageUrl: row.words.comic_image_url ?? null,
    addedAt: row.added_at,
  }))

  return NextResponse.json({ words })
}
```

- [ ] **Step 3: Create WordCard component**

Create `src/components/WordCard.tsx`:
```tsx
import Link from 'next/link'
import type { UserWord } from '@/types'

export default function WordCard({ word }: { word: UserWord }) {
  return (
    <Link href={`/search/${encodeURIComponent(word.word)}`}>
      <div className="bg-white rounded-3xl p-5 border-2 border-yellow-100 hover:border-orange-300 transition-colors shadow-sm flex gap-4 items-start">
        {word.comicImageUrl && (
          <img
            src={word.comicImageUrl}
            alt={word.word}
            className="w-24 h-14 object-cover rounded-2xl flex-shrink-0"
          />
        )}
        <div className="min-w-0">
          <h3 className="font-fredoka text-2xl text-orange-400">{word.word}</h3>
          <p className="font-nunito text-gray-600 truncate">{word.definition}</p>
        </div>
      </div>
    </Link>
  )
}
```

- [ ] **Step 4: Create dictionary page**

Create `src/app/dictionary/page.tsx`:
```tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import WordCard from '@/components/WordCard'
import Link from 'next/link'
import type { UserWord } from '@/types'

export default async function DictionaryPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/signin')

  const res = await fetch(
    `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/api/dictionary`,
    { headers: { cookie: '' }, cache: 'no-store' }
  )
  const { words }: { words: UserWord[] } = res.ok ? await res.json() : { words: [] }

  return (
    <main className="min-h-screen p-6 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-fredoka text-4xl text-orange-400">My Dictionary</h1>
        <Link href="/games" className="bg-yellow-400 hover:bg-yellow-500 text-white font-fredoka text-lg rounded-2xl px-4 py-2 transition-colors">
          Play Games!
        </Link>
      </div>

      {words.length === 0 ? (
        <div className="text-center py-12">
          <p className="font-nunito text-xl text-gray-400">No words saved yet.</p>
          <Link href="/" className="text-orange-400 font-nunito hover:underline">Search for a word to get started!</Link>
        </div>
      ) : (
        <div className="space-y-3">
          {words.map(word => <WordCard key={word.id} word={word} />)}
        </div>
      )}
    </main>
  )
}
```

> **Note:** The dictionary page calls its own API route. For server components calling internal Next.js API routes, pass the request cookies via the `cookie` header so Supabase can authenticate the request. Update the fetch to use the actual cookie header:

Replace the fetch in `dictionary/page.tsx` with a direct Supabase query instead (avoids the self-call complexity):

```tsx
// Replace the fetch block with:
const { data: rawWords } = await supabase
  .from('user_words')
  .select(`
    id, added_at,
    words (id, word, definition, examples, synonyms, phonetic, pronunciation_url, comic_image_url)
  `)
  .eq('user_id', user.id)
  .order('added_at', { ascending: false })

const words: UserWord[] = (rawWords ?? []).map((row: any) => ({
  id: row.id,
  wordId: row.words.id,
  word: row.words.word,
  definition: row.words.definition,
  examples: row.words.examples ?? [],
  synonyms: row.words.synonyms ?? [],
  phonetic: row.words.phonetic ?? null,
  pronunciationUrl: row.words.pronunciation_url ?? null,
  comicImageUrl: row.words.comic_image_url ?? null,
  addedAt: row.added_at,
}))
```

- [ ] **Step 5: Commit**

```bash
git add src/app/api/word-save/ src/app/api/dictionary/ src/components/WordCard.tsx src/app/dictionary/
git commit -m "feat: add save word API, dictionary API, and dictionary page"
```

---

## Task 14: Quiz Game

**Files:**
- Create: `src/app/api/games/quiz/route.ts`
- Create: `src/components/games/QuizGame.tsx`
- Create: `src/app/games/quiz/page.tsx`
- Create: `src/__tests__/api/quiz.test.ts`

- [ ] **Step 1: Write quiz generation tests**

Create `src/__tests__/api/quiz.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { generateQuizQuestions } from '@/lib/quiz'
import type { UserWord } from '@/types'

const makeWord = (word: string, definition: string): UserWord => ({
  id: `id-${word}`, wordId: `wid-${word}`, word, definition,
  examples: [], synonyms: [], phonetic: null,
  pronunciationUrl: null, comicImageUrl: null, addedAt: new Date().toISOString()
})

const fourWords = [
  makeWord('enormous', 'Very big'),
  makeWord('swift', 'Very fast'),
  makeWord('brave', 'Not afraid'),
  makeWord('gentle', 'Soft and kind'),
]

describe('generateQuizQuestions', () => {
  it('generates questions from saved words', () => {
    const questions = generateQuizQuestions(fourWords, 4)
    expect(questions).toHaveLength(4)
  })

  it('each question has 4 choices', () => {
    const questions = generateQuizQuestions(fourWords, 2)
    for (const q of questions) {
      expect(q.choices).toHaveLength(4)
    }
  })

  it('correct answer is always in choices', () => {
    const questions = generateQuizQuestions(fourWords, 10)
    for (const q of questions) {
      expect(q.choices[q.answerIndex]).toBeDefined()
    }
  })

  it('both question modes are used across enough questions', () => {
    const questions = generateQuizQuestions(fourWords, 20)
    const modes = new Set(questions.map(q => q.mode))
    expect(modes.size).toBe(2)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- src/__tests__/api/quiz.test.ts
```
Expected: FAIL — `Cannot find module '@/lib/quiz'`

- [ ] **Step 3: Create quiz logic module**

Create `src/lib/quiz.ts`:
```ts
import { config } from '@/config'
import type { UserWord, QuizQuestion } from '@/types'

// globalWords: extra words from the DB used to fill distractor gaps when savedWords is small
export function generateQuizQuestions(
  savedWords: UserWord[],
  count: number,
  globalWords: UserWord[] = []
): QuizQuestion[] {
  if (savedWords.length < config.games.minWordsRequired) return []

  // Combined pool for distractors: saved words first, then global words
  const allWords = [...savedWords, ...globalWords.filter(
    g => !savedWords.some(s => s.wordId === g.wordId)
  )]

  const questions: QuizQuestion[] = []
  const wordPool = [...savedWords]

  for (let i = 0; i < count; i++) {
    const correct = wordPool[i % wordPool.length]
    const mode: QuizQuestion['mode'] =
      i % 2 === 0 ? 'word-to-meaning' : 'meaning-to-word'

    const others = allWords.filter(w => w.wordId !== correct.wordId)
    const distractors = shuffle(others).slice(0, config.games.mcqChoices - 1)

    const wrongChoices =
      mode === 'word-to-meaning'
        ? distractors.map(w => w.definition)
        : distractors.map(w => w.word)

    const correctChoice =
      mode === 'word-to-meaning' ? correct.definition : correct.word

    const choices = shuffle([correctChoice, ...wrongChoices]).slice(0, config.games.mcqChoices)
    const answerIndex = choices.indexOf(correctChoice)

    questions.push({
      mode,
      prompt: mode === 'word-to-meaning' ? correct.word : correct.definition,
      choices,
      answerIndex,
    })
  }

  return questions
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- src/__tests__/api/quiz.test.ts
```
Expected: PASS

- [ ] **Step 5: Create quiz API route**

Create `src/app/api/games/quiz/route.ts`:
```ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateQuizQuestions } from '@/lib/quiz'
import { config } from '@/config'
import type { UserWord } from '@/types'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const count = Math.min(Number(searchParams.get('count') ?? config.games.quizQuestionCount), 20)

  const { data: rawWords } = await supabase
    .from('user_words')
    .select('id, added_at, words(id, word, definition, examples, synonyms, phonetic, pronunciation_url, comic_image_url)')
    .eq('user_id', user.id)

  const words: UserWord[] = (rawWords ?? []).map((row: any) => ({
    id: row.id, wordId: row.words.id, word: row.words.word,
    definition: row.words.definition, examples: row.words.examples ?? [],
    synonyms: row.words.synonyms ?? [], phonetic: row.words.phonetic ?? null,
    pronunciationUrl: row.words.pronunciation_url ?? null,
    comicImageUrl: row.words.comic_image_url ?? null, addedAt: row.added_at,
  }))

  if (words.length < config.games.minWordsRequired) {
    return NextResponse.json(
      { error: `Need at least ${config.games.minWordsRequired} saved words to play` },
      { status: 400 }
    )
  }

  // Fetch global words as distractor supplements when saved words count is low
  let globalWords: UserWord[] = []
  if (words.length <= config.games.mcqChoices) {
    const { data: profile } = await supabase.from('profiles').select('age_group').eq('id', user.id).single()
    const ageGroup = profile?.age_group ?? '4-6'
    const { data: extras } = await supabase
      .from('words').select('id, word, definition, examples, synonyms, phonetic, pronunciation_url, comic_image_url')
      .eq('age_group', ageGroup).limit(20)
    globalWords = (extras ?? []).map((w: any) => ({
      id: '', wordId: w.id, word: w.word, definition: w.definition,
      examples: w.examples ?? [], synonyms: w.synonyms ?? [],
      phonetic: w.phonetic ?? null, pronunciationUrl: w.pronunciation_url ?? null,
      comicImageUrl: w.comic_image_url ?? null, addedAt: '',
    }))
  }

  const questions = generateQuizQuestions(words, count, globalWords)
  return NextResponse.json({ questions })
}
```

- [ ] **Step 6: Create QuizGame component**

Create `src/components/games/QuizGame.tsx`:
```tsx
'use client'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { QuizQuestion } from '@/types'

interface Props {
  questions: QuizQuestion[]
  onComplete: (score: number, total: number) => void
}

export default function QuizGame({ questions, onComplete }: Props) {
  const [current, setCurrent] = useState(0)
  const [selected, setSelected] = useState<number | null>(null)
  const [score, setScore] = useState(0)

  const question = questions[current]
  const isAnswered = selected !== null
  const isCorrect = selected === question.answerIndex

  function handleSelect(index: number) {
    if (isAnswered) return
    setSelected(index)
    if (index === question.answerIndex) setScore(s => s + 1)
  }

  function handleNext() {
    if (current + 1 >= questions.length) {
      onComplete(score + (isCorrect ? 1 : 0), questions.length)
    } else {
      setCurrent(c => c + 1)
      setSelected(null)
    }
  }

  const buttonColors = (index: number) => {
    if (!isAnswered) return 'bg-white border-yellow-200 hover:border-orange-300 text-gray-700'
    if (index === question.answerIndex) return 'bg-green-100 border-green-400 text-green-800'
    if (index === selected) return 'bg-red-100 border-red-400 text-red-800'
    return 'bg-white border-yellow-200 text-gray-400'
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={current}
        initial={{ opacity: 0, x: 40 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -40 }}
        className="space-y-6"
      >
        <div className="flex justify-between font-nunito text-gray-400">
          <span>Question {current + 1} of {questions.length}</span>
          <span>Score: {score}</span>
        </div>

        <div className="bg-white rounded-3xl p-6 border-2 border-yellow-100 shadow-sm">
          <p className="font-nunito text-sm text-gray-400 mb-2">
            {question.mode === 'word-to-meaning' ? 'What does this word mean?' : 'Which word matches this meaning?'}
          </p>
          <p className="font-fredoka text-3xl text-orange-400">{question.prompt}</p>
        </div>

        <div className="space-y-3">
          {question.choices.map((choice, i) => (
            <motion.button
              key={i}
              onClick={() => handleSelect(i)}
              whileTap={!isAnswered ? { scale: 0.97 } : {}}
              className={`w-full text-left rounded-2xl px-5 py-4 border-2 font-nunito text-lg transition-colors ${buttonColors(i)}`}
            >
              {choice}
              {isAnswered && i === question.answerIndex && ' ✓'}
            </motion.button>
          ))}
        </div>

        {isAnswered && (
          <button
            onClick={handleNext}
            className="w-full bg-orange-400 hover:bg-orange-500 text-white font-fredoka text-xl rounded-2xl py-4 transition-colors"
          >
            {current + 1 >= questions.length ? 'See Results!' : 'Next →'}
          </button>
        )}
      </motion.div>
    </AnimatePresence>
  )
}
```

- [ ] **Step 7: Create quiz page**

Create `src/app/games/quiz/page.tsx`:
```tsx
'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import QuizGame from '@/components/games/QuizGame'
import type { QuizQuestion } from '@/types'

export default function QuizPage() {
  const [questions, setQuestions] = useState<QuizQuestion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [result, setResult] = useState<{ score: number; total: number } | null>(null)
  const router = useRouter()

  useEffect(() => {
    fetch('/api/games/quiz')
      .then(r => r.json())
      .then(data => {
        if (data.error) setError(data.error)
        else setQuestions(data.questions)
      })
      .catch(() => setError('Failed to load quiz'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <main className="min-h-screen flex items-center justify-center"><p className="font-fredoka text-2xl text-orange-400">Loading quiz...</p></main>

  if (error) return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-4 p-6">
      <p className="font-nunito text-xl text-gray-500">{error}</p>
      <button onClick={() => router.push('/dictionary')} className="text-orange-400 font-nunito hover:underline">
        Add more words first
      </button>
    </main>
  )

  if (result) return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-6 p-6">
      <h1 className="font-fredoka text-5xl text-orange-400">
        {result.score === result.total ? '🎉 Perfect!' : result.score >= result.total / 2 ? '⭐ Great job!' : '💪 Keep practising!'}
      </h1>
      <p className="font-nunito text-2xl text-gray-600">{result.score} / {result.total}</p>
      <div className="flex gap-4">
        <button onClick={() => { setResult(null); setQuestions([]); setLoading(true); fetch('/api/games/quiz').then(r => r.json()).then(d => { setQuestions(d.questions); setLoading(false) }) }}
          className="bg-orange-400 hover:bg-orange-500 text-white font-fredoka text-xl rounded-2xl px-6 py-3 transition-colors">
          Play Again
        </button>
        <button onClick={() => router.push('/games')} className="bg-yellow-200 hover:bg-yellow-300 text-gray-700 font-fredoka text-xl rounded-2xl px-6 py-3 transition-colors">
          Other Games
        </button>
      </div>
    </main>
  )

  return (
    <main className="min-h-screen p-6 max-w-lg mx-auto pt-12">
      <h1 className="font-fredoka text-3xl text-orange-400 mb-8">Word Quiz</h1>
      <QuizGame questions={questions} onComplete={(score, total) => setResult({ score, total })} />
    </main>
  )
}
```

- [ ] **Step 8: Commit**

```bash
git add src/lib/quiz.ts src/app/api/games/quiz/ src/components/games/QuizGame.tsx src/app/games/quiz/ src/__tests__/api/quiz.test.ts
git commit -m "feat: add quiz game with MCQ logic and tests"
```

---

## Task 15: Crossword Game

**Files:**
- Create: `src/app/api/games/crossword/route.ts`
- Create: `src/components/games/CrosswordGame.tsx`
- Create: `src/app/games/crossword/page.tsx`

> **Context:** The `crossword-layout-generator` package takes an array of `{answer, clue}` objects and returns a grid layout. We render this as an interactive HTML grid. The user types into cells. Input validation is case-insensitive.

- [ ] **Step 1: Create crossword API route**

Create `src/app/api/games/crossword/route.ts`:
```ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { config } from '@/config'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: rawWords } = await supabase
    .from('user_words')
    .select('words(word, definition)')
    .eq('user_id', user.id)

  const words = (rawWords ?? []).map((row: any) => ({
    word: row.words.word as string,
    definition: row.words.definition as string,
  }))

  if (words.length < config.games.minWordsRequired) {
    return NextResponse.json(
      { error: `Need at least ${config.games.minWordsRequired} saved words to play` },
      { status: 400 }
    )
  }

  return NextResponse.json({ words })
}
```

- [ ] **Step 2: Create CrosswordGame component**

Create `src/components/games/CrosswordGame.tsx`:
```tsx
'use client'
import { useState, useEffect, useRef } from 'react'
// @ts-expect-error — no type declarations for this package
import CrosswordLayoutGenerator from 'crossword-layout-generator'

interface WordEntry { word: string; definition: string }
interface Props { words: WordEntry[] }

interface Cell {
  letter: string
  number?: number
  across?: number
  down?: number
  isBlack?: boolean
}

export default function CrosswordGame({ words }: Props) {
  const [grid, setGrid] = useState<Cell[][]>([])
  const [clues, setClues] = useState<{ across: any[]; down: any[] }>({ across: [], down: [] })
  const [userInput, setUserInput] = useState<Map<string, string>>(new Map())
  const [solved, setSolved] = useState(false)

  useEffect(() => {
    const entries = words.map(w => ({ answer: w.word.toUpperCase(), clue: w.definition }))
    try {
      const layout = CrosswordLayoutGenerator.generateLayout(entries)
      setGrid(layout.table ?? [])
      setClues({ across: layout.result?.filter((r: any) => r.orientation === 'across') ?? [],
                 down: layout.result?.filter((r: any) => r.orientation === 'down') ?? [] })
    } catch {
      // Layout generation can fail with certain word combinations — show empty state
    }
  }, [words])

  function handleInput(row: number, col: number, value: string) {
    const key = `${row}-${col}`
    const newMap = new Map(userInput)
    newMap.set(key, value.toUpperCase().slice(-1))
    setUserInput(newMap)
    checkSolved(newMap)
  }

  function checkSolved(input: Map<string, string>) {
    for (let r = 0; r < grid.length; r++) {
      for (let c = 0; c < grid[r].length; c++) {
        const cell = grid[r][c]
        if (!cell || cell.isBlack || !cell.letter) continue
        if ((input.get(`${r}-${c}`) ?? '') !== cell.letter) return
      }
    }
    setSolved(true)
  }

  if (grid.length === 0) return <p className="font-nunito text-gray-400">Generating crossword...</p>

  return (
    <div className="space-y-8">
      {solved && (
        <div className="bg-green-100 border-2 border-green-300 rounded-3xl p-6 text-center">
          <p className="font-fredoka text-3xl text-green-600">🎉 You solved it!</p>
        </div>
      )}

      {/* Grid */}
      <div className="overflow-auto">
        <table className="border-collapse mx-auto">
          <tbody>
            {grid.map((row, r) => (
              <tr key={r}>
                {row.map((cell, c) => {
                  if (!cell || cell.isBlack) return <td key={c} className="w-9 h-9 bg-gray-800" />
                  return (
                    <td key={c} className="w-9 h-9 border border-gray-300 relative p-0">
                      {cell.number && (
                        <span className="absolute top-0 left-0.5 text-[9px] font-nunito text-gray-500 leading-none">
                          {cell.number}
                        </span>
                      )}
                      <input
                        maxLength={1}
                        value={userInput.get(`${r}-${c}`) ?? ''}
                        onChange={e => handleInput(r, c, e.target.value)}
                        className={`w-full h-full text-center font-fredoka text-lg uppercase focus:bg-yellow-100 focus:outline-none ${
                          userInput.get(`${r}-${c}`) === cell.letter ? 'text-green-600' : 'text-gray-800'
                        }`}
                      />
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Clues */}
      <div className="grid md:grid-cols-2 gap-6">
        {[{ label: 'Across', list: clues.across }, { label: 'Down', list: clues.down }].map(({ label, list }) => (
          <div key={label}>
            <h3 className="font-fredoka text-xl text-orange-400 mb-3">{label}</h3>
            <ol className="space-y-2">
              {list.map((clue: any) => (
                <li key={clue.position} className="font-nunito text-gray-600 text-sm">
                  <strong>{clue.position}.</strong> {clue.clue}
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

- [ ] **Step 3: Create crossword page**

Create `src/app/games/crossword/page.tsx`:
```tsx
'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import CrosswordGame from '@/components/games/CrosswordGame'

export default function CrosswordPage() {
  const [words, setWords] = useState<{ word: string; definition: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const router = useRouter()

  useEffect(() => {
    fetch('/api/games/crossword')
      .then(r => r.json())
      .then(data => {
        if (data.error) setError(data.error)
        else setWords(data.words)
      })
      .catch(() => setError('Failed to load crossword'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <main className="min-h-screen flex items-center justify-center"><p className="font-fredoka text-2xl text-orange-400">Building crossword...</p></main>

  if (error) return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-4 p-6">
      <p className="font-nunito text-xl text-gray-500">{error}</p>
      <button onClick={() => router.push('/dictionary')} className="text-orange-400 font-nunito hover:underline">
        Add more words first
      </button>
    </main>
  )

  return (
    <main className="min-h-screen p-6 max-w-3xl mx-auto space-y-6">
      <h1 className="font-fredoka text-3xl text-orange-400">Word Crossword</h1>
      <CrosswordGame words={words} />
    </main>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/games/crossword/ src/components/games/CrosswordGame.tsx src/app/games/crossword/
git commit -m "feat: add crossword game"
```

---

## Task 16: Games Hub Page

**Files:**
- Create: `src/app/games/page.tsx`

- [ ] **Step 1: Create games hub page**

Create `src/app/games/page.tsx`:
```tsx
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { config } from '@/config'

export default async function GamesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/signin')

  const { count } = await supabase
    .from('user_words')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)

  const wordCount = count ?? 0
  const hasEnough = wordCount >= config.games.minWordsRequired

  return (
    <main className="min-h-screen p-6 max-w-2xl mx-auto space-y-6">
      <h1 className="font-fredoka text-4xl text-orange-400">Games</h1>

      {!hasEnough && (
        <div className="bg-yellow-100 border-2 border-yellow-300 rounded-3xl p-5">
          <p className="font-nunito text-gray-700">
            You need at least <strong>{config.games.minWordsRequired} saved words</strong> to play.
            You have {wordCount} so far.{' '}
            <Link href="/" className="text-orange-400 hover:underline">Search for more words!</Link>
          </p>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        <Link href={hasEnough ? '/games/quiz' : '#'}>
          <div className={`bg-white rounded-3xl p-8 border-2 text-center transition-colors ${hasEnough ? 'border-yellow-200 hover:border-orange-300' : 'border-gray-100 opacity-50'}`}>
            <div className="text-5xl mb-3">🧠</div>
            <h2 className="font-fredoka text-2xl text-orange-400">Word Quiz</h2>
            <p className="font-nunito text-gray-500 mt-1">Match words to their meanings</p>
          </div>
        </Link>
        <Link href={hasEnough ? '/games/crossword' : '#'}>
          <div className={`bg-white rounded-3xl p-8 border-2 text-center transition-colors ${hasEnough ? 'border-yellow-200 hover:border-orange-300' : 'border-gray-100 opacity-50'}`}>
            <div className="text-5xl mb-3">✏️</div>
            <h2 className="font-fredoka text-2xl text-orange-400">Crossword</h2>
            <p className="font-nunito text-gray-500 mt-1">Spell words from clues</p>
          </div>
        </Link>
      </div>

      <Link href="/dictionary" className="block text-center font-nunito text-gray-400 hover:text-orange-400 transition-colors">
        ← Back to My Dictionary
      </Link>
    </main>
  )
}
```

- [ ] **Step 2: Run all tests**

```bash
npm test
```
Expected: All tests PASS.

- [ ] **Step 3: Commit**

```bash
git add src/app/games/page.tsx
git commit -m "feat: add games hub page"
```

---

## Task 17: Final Verification and Deployment

- [ ] **Step 1: Run the full test suite**

```bash
npm test
```
Expected: All tests pass.

- [ ] **Step 2: Build the project**

```bash
npm run build
```
Expected: Build completes without errors. Fix any TypeScript or build errors before continuing.

- [ ] **Step 3: Set NEXT_PUBLIC_APP_URL for production**

Before deploying to Vercel, you need to know your production URL. Vercel will assign one (e.g. `kid-dictionary.vercel.app`). Add it to Vercel environment variables as `NEXT_PUBLIC_APP_URL`.

- [ ] **Step 4: Deploy to Vercel**

```bash
npx vercel
```
Follow the prompts. When asked for environment variables, add all keys from `.env.example`.

Alternatively, connect the GitHub repo to Vercel for automatic deployments on every push.

- [ ] **Step 5: Update Supabase Auth settings**

In Supabase Dashboard → Authentication → URL Configuration:
- Site URL: your Vercel production URL
- Redirect URLs: add `https://your-app.vercel.app/auth/callback`

- [ ] **Step 6: Smoke test production**

- Search a word → verify dictionary entry and comic appear
- Sign up → verify profile is created with correct age group
- Save a word → verify it appears in `/dictionary`
- Play quiz → verify questions appear and scoring works
- Play crossword → verify grid renders

- [ ] **Step 7: Final commit**

```bash
git add -A
git commit -m "feat: complete kids dictionary MVP"
```

---

## Pre-Production Checklist

Before sharing the app publicly, add these (not in MVP scope):

- [ ] **Error monitoring** — add Sentry for production error tracking
- [ ] **Accessibility** — verify keyboard navigation and screen reader support
- [ ] **Mobile testing** — test on iOS Safari and Android Chrome
