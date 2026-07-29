import type { DictionaryApiResult } from '@/types'
import { config } from '@/config'

const API_BASE = 'https://api.dictionaryapi.dev/api/v2/entries/en'

export async function fetchWordFromDictionaryApi(
  word: string
): Promise<DictionaryApiResult | null> {
  const trimmed = word.trim().toLowerCase().slice(0, config.word.maxInputLength)

  // Network failures, DNS errors and timeouts all reject the fetch promise
  // rather than resolving with a non-ok response, so they need their own
  // catch: an unreachable upstream must degrade to null, the same as a 404,
  // not crash the word page.
  try {
    const res = await fetch(`${API_BASE}/${encodeURIComponent(trimmed)}`, {
      signal: AbortSignal.timeout(config.network.requestTimeoutMs),
    })

    if (!res.ok) return null

    const data = await res.json()
    const entry = data[0]
    if (!entry) return null

    type PhoneticEntry = { text?: string }
    const phonetic = entry.phonetics?.find((p: PhoneticEntry) => p.text)?.text ?? null

    // Collect first definition
    const firstMeaning = entry.meanings?.[0]
    const rawDefinition = firstMeaning?.definitions?.[0]?.definition ?? ''
    const partOfSpeech: string | null = firstMeaning?.partOfSpeech ?? null

    // Collect synonyms from all meanings, up to limit
    const synonyms: string[] = []
    for (const meaning of entry.meanings ?? []) {
      synonyms.push(...(meaning.synonyms ?? []))
      for (const def of meaning.definitions ?? []) {
        synonyms.push(...(def.synonyms ?? []))
      }
    }
    const uniqueSynonyms = Array.from(new Set(synonyms)).slice(0, config.word.maxSynonyms)

    return { phonetic, partOfSpeech, rawDefinition, synonyms: uniqueSynonyms }
  } catch {
    return null
  }
}
