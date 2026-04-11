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
    .from('words')
    .select('*')
    .eq('word', word)
    .eq('age_group', ageGroup)
    .single()

  if (cached) return { found: true, data: dbRowToWordData(cached) }

  // 2. Validate with dictionary API
  const dictResult = await fetchWordFromDictionaryApi(word)
  if (!dictResult) return { found: false }

  // 3. Enrich with Claude (graceful failure)
  const enriched = await enrichWord(word, dictResult.rawDefinition, ageGroup)
  if (!enriched) {
    return {
      found: true,
      data: {
        id: null, word, ageGroup,
        definition: dictResult.rawDefinition,
        examples: [], synonyms: dictResult.synonyms,
        phonetic: dictResult.phonetic, pronunciationUrl: dictResult.pronunciationUrl,
        storyScript: [], comicImageUrl: null,
      } as unknown as WordData & { id: string | null },
    }
  }

  // 4. Generate story script (graceful failure)
  const storyScript = await generateStoryScript(word, ageGroup)
  if (!storyScript) {
    return {
      found: true,
      data: {
        id: null, word, ageGroup,
        definition: enriched.definition, examples: enriched.examples,
        synonyms: dictResult.synonyms, phonetic: dictResult.phonetic,
        pronunciationUrl: dictResult.pronunciationUrl,
        storyScript: [], comicImageUrl: null,
      } as unknown as WordData & { id: string | null },
    }
  }

  // 5. Generate comic image (graceful failure — null is fine)
  const { sceneCount } = getAgeGroupConfig(ageGroup)
  const comicImageUrl = await generateAndStoreComicImage(word, ageGroup, storyScript, sceneCount)

  // 6. Cache result in DB
  const { data: inserted } = await supabase
    .from('words')
    .insert({
      word, age_group: ageGroup,
      definition: enriched.definition, examples: enriched.examples,
      synonyms: dictResult.synonyms, phonetic: dictResult.phonetic,
      pronunciation_url: dictResult.pronunciationUrl,
      story_script: storyScript, comic_image_url: comicImageUrl,
    })
    .select()
    .single()

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
