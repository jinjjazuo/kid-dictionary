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

  type PhoneticEntry = { text?: string; audio?: string }
  // Find first phonetic with both text and audio
  const phoneticWithAudio = entry.phonetics?.find(
    (p: PhoneticEntry) => p.text && p.audio
  )
  const anyPhonetic = entry.phonetics?.find((p: PhoneticEntry) => p.text)

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
  const uniqueSynonyms = Array.from(new Set(synonyms)).slice(0, config.word.maxSynonyms)

  return { phonetic, pronunciationUrl, rawDefinition, synonyms: uniqueSynonyms }
}
