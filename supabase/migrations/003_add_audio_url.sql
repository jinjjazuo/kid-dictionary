-- Wiktionary recording of the word, hosted on Wikimedia Commons.
--
-- Added when the dictionary source moved from dictionaryapi.dev to kaikki.org
-- (Wiktionary parsed by Wiktextract), which resolves a real mp3 URL per word.
--
-- Nullable because most words have no recording, and a word without one is
-- ordinary rather than broken — the play button simply does not render.
--
-- Adding a column leaves existing rows valid, so no backfill and no
-- text_version bump: cached words keep serving, they just have no audio until
-- something else causes them to regenerate.

alter table public.words add column if not exists audio_url text;
