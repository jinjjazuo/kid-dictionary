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
