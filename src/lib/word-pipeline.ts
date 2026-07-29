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

  // 3. Validate the word exists before calling a paid model. An entry with
  // an empty definition is treated the same as no entry — rendering it
  // would produce a blank word page, and there is nothing for the AI step
  // to enrich.
  const dict = await fetchWordFromDictionaryApi(normalised)
  if (!dict || !dict.rawDefinition) return { found: false }

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
