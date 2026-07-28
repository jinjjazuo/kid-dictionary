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
| `AI_PROVIDER` | `gemini` or `qwen`. Defaults to `gemini`. |
| `GOOGLE_AI_API_KEY` | https://aistudio.google.com/apikey |
| `OPENROUTER_API_KEY` | https://openrouter.ai/keys — only for `qwen` |

## Supabase setup

Under **Settings → API → Security**: Data API **on**, automatically expose new
tables **off**, automatic RLS **on**.

Create a **public** Storage bucket named `comics`, then run
`supabase/migrations/002_revamp_schema.sql` in the SQL editor. The migration
also grants the `service_role` the table access the server-side client needs,
since automatic RLS leaves it with none by default.

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

Comics are currently text-only: free Gemini API keys carry no image quota, so
the pipeline stores a null `comic_image_url` when generation fails and the UI
renders the story text on its own, without a strip.

See `docs/superpowers/specs/2026-07-28-kid-dictionary-revamp-design.md` for
the design decisions and why they were made.
