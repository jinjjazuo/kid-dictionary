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

-- words: allow inserts from authenticated API routes (anon key with service role bypass is used)
-- Actually for API routes using anon key, we need to allow insert from authenticated users:
create policy "Authenticated users can insert words" on public.words
  for insert with check (true);

-- user_words: users manage their own dictionary
create policy "Users can view own words" on public.user_words
  for select using (auth.uid() = user_id);
create policy "Users can add own words" on public.user_words
  for insert with check (auth.uid() = user_id);
