import { config, getAgeGroupConfig } from '@/config'
import { createServiceClient } from '@/lib/supabase/server'
import { fetchWordFromDictionaryApi } from '@/lib/dictionary-api'
import { getImageProvider, getTextProvider } from '@/lib/ai'
import { buildImagePrompt } from '@/lib/ai/prompts'
import { getImageStore } from '@/lib/storage'
import { comicObjectKey, compressToWebp } from '@/lib/images/compress'
import { checkWord } from '@/lib/safety/check'
import type { AgeGroup, Scene, WordData } from '@/types'

/**
 * `comic` carries the illustration, which resolves long after `data`.
 *
 * The two are split so the page can render the definition immediately and
 * stream the comic in under a Suspense boundary. Image generation takes tens
 * of seconds; making a child wait that long to read what a word means was the
 * whole reason for the split.
 *
 * On a cache hit `comic` is already resolved and `data.comicImageUrl` holds
 * the same value. On a miss `data.comicImageUrl` is null because the URL is
 * not known yet — `comic` is the authority, never the field.
 *
 * `comic` never rejects. A rejection would surface at the Suspense boundary
 * and take the definition down with it, which is exactly what the
 * graceful-degradation rule forbids.
 */
export type WordResult =
  | { found: false }
  | { found: true; data: WordData; comic: Promise<string | null> }

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
  audio_url: string | null
  text_version: number
}

/** Everything the cache row needs except the URL the comic step produces. */
type PendingRow = {
  word: string
  age_group: AgeGroup
  definition: string
  part_of_speech: string | null
  examples: string[]
  synonyms: string[]
  phonetic: string | null
  story_script: Scene[]
  audio_url: string | null
  text_version: number
  image_version: number
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
    audioUrl: row.audio_url,
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
 * The order is unchanged by the text/comic split — the comic is still drawn
 * after the text, and the row is still written exactly once, at the end. The
 * only difference is that the caller gets the text back before the comic
 * finishes instead of after.
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

  if (cached) {
    const data = dbRowToWordData(cached as DbRow)
    return { found: true, data, comic: Promise.resolve(data.comicImageUrl) }
  }

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
    audioUrl: dict.audioUrl,
    textVersion: config.content.textVersion,
  }

  // 4-5. One combined text call: definition, examples and (for non-sensitive
  // words) the story script. A single request instead of two, because the
  // text provider's free tier is metered per request. On total failure, show
  // the raw dictionary text and do not cache.
  const { sceneCount } = getAgeGroupConfig(ageGroup)
  const content = await getTextProvider().generateWordContent(
    normalised,
    dict.rawDefinition,
    ageGroup,
    allowComic ? sceneCount : 0,
  )
  if (!content) {
    return {
      found: true,
      data: {
        ...base,
        definition: dict.rawDefinition,
        examples: [],
        storyScript: [],
        comicImageUrl: null,
      },
      comic: Promise.resolve(null),
    }
  }

  const withText = {
    ...base,
    definition: content.definition,
    examples: content.examples,
  }

  // scenes === null means the story part of the response was unusable while
  // the text was fine. Serve the text but do not cache, so a retry can still
  // produce the comic.
  if (content.scenes === null) {
    return {
      found: true,
      data: { ...withText, storyScript: [], comicImageUrl: null },
      comic: Promise.resolve(null),
    }
  }

  const storyScript = content.scenes

  // 6-9. Comic then cache, deferred. Not awaited here: this is the promise
  // the page streams into, and awaiting it would restore the very delay the
  // split exists to remove.
  return {
    found: true,
    data: { ...withText, storyScript, comicImageUrl: null },
    comic: completeComicAndCache(supabase, {
      word: normalised,
      age_group: ageGroup,
      definition: content.definition,
      part_of_speech: dict.partOfSpeech,
      examples: content.examples,
      synonyms: dict.synonyms,
      phonetic: dict.phonetic,
      story_script: storyScript,
      audio_url: dict.audioUrl,
      text_version: config.content.textVersion,
      image_version: config.content.imageVersion,
    }),
  }
}

/**
 * Draws the comic, then writes the one cache row for this lookup.
 *
 * Both steps are swallowed on failure so the returned promise cannot reject —
 * see the note on WordResult. The two catches are separate on purpose: a
 * failed insert must not discard a comic URL that was generated successfully,
 * because the page can still show it even though the next visitor will have
 * to regenerate it.
 */
async function completeComicAndCache(
  supabase: ReturnType<typeof createServiceClient>,
  row: PendingRow,
): Promise<string | null> {
  let comicImageUrl: string | null = null

  try {
    if (row.story_script.length > 0) {
      comicImageUrl = await generateComicUrl(row.word, row.age_group, row.story_script)
    }
  } catch {
    // The provider threw rather than returning null. The text is still worth
    // caching, so fall through to the insert.
  }

  try {
    await supabase.from('words').insert({ ...row, comic_image_url: comicImageUrl })
  } catch {
    // A concurrent request for the same word most likely won the unique
    // constraint, or the network failed. Either way the caller still gets
    // what was generated.
  }

  return comicImageUrl
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
