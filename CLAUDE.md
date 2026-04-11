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
