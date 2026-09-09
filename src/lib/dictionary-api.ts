import type { DictionaryApiResult } from '@/types'
import { config } from '@/config'

/** One sense of one part of speech, as Wiktextract emits it. */
type KaikkiSense = {
  glosses?: string[]
  tags?: string[]
  synonyms?: { word?: string }[]
}

/** One part of speech. A word's file holds one of these per line. */
type KaikkiEntry = {
  pos?: string
  sounds?: { ipa?: string; mp3_url?: string; ogg_url?: string }[]
  senses?: KaikkiSense[]
  synonyms?: { word?: string }[]
}

const EXCLUDED: readonly string[] = config.dictionary.excludedSenseTags

/**
 * Wiktextract's abbreviations, spelled out.
 *
 * Lives here rather than in config because it describes this one source's
 * vocabulary, not a preference anyone would tune. The Badge both colours and
 * *displays* this string, so "adj" would render grey and read as "adj" to a
 * child. Anything absent passes through unchanged — the badge already has a
 * neutral fallback.
 */
const PART_OF_SPEECH_NAMES: Record<string, string> = {
  adj: 'adjective',
  adv: 'adverb',
  pron: 'pronoun',
  prep: 'preposition',
  conj: 'conjunction',
  intj: 'interjection',
  det: 'determiner',
  num: 'numeral',
}

/**
 * Picks the sense a child should be taught.
 *
 * Wiktionary orders senses historically rather than by frequency, so the
 * first sense of "enormous" is the obsolete "deviating from the norm" and the
 * modern "extremely large" is third. Handing the first one to the model
 * produces a confident, wrong definition, which is worse than no definition.
 *
 * Falls back to a filtered sense when every sense is tagged, because a dated
 * definition still answers the child's question.
 */
function pickGloss(senses: KaikkiSense[]): string | null {
  const glossed = senses.filter(s => s.glosses?.[0])
  const plain = glossed.find(s => !s.tags?.some(t => EXCLUDED.includes(t)))
  return (plain ?? glossed[0])?.glosses?.[0] ?? null
}

/**
 * Fetches the raw dictionary entry that gates every billable step.
 *
 * Source is kaikki.org, which publishes Wiktionary already parsed into JSON.
 * It answers a known word in about a second and 404s an unknown one, unlike
 * the dictionaryapi.dev it replaced, which hung for 20 seconds on anything it
 * did not have.
 *
 * Returns null for anything unusable — 404, hang, malformed payload — because
 * the pipeline treats "no entry" as "word not found" and stops there, so an
 * upstream outage costs a wrong answer rather than a crashed word page.
 */
export async function fetchWordFromDictionaryApi(
  word: string
): Promise<DictionaryApiResult | null> {
  const trimmed = word.trim().toLowerCase().slice(0, config.word.maxInputLength)
  if (!trimmed) return null

  // Files are sharded by first letter then first two, and a one-letter word
  // uses that letter for both.
  const url =
    `${config.dictionary.baseUrl}/${trimmed[0]}/${trimmed.slice(0, 2)}/` +
    `${encodeURIComponent(trimmed)}.jsonl`

  // Network failures, DNS errors and timeouts all reject the fetch promise
  // rather than resolving with a non-ok response, so they need their own
  // catch: an unreachable upstream must degrade to null, the same as a 404,
  // not crash the word page.
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': config.dictionary.userAgent },
      signal: AbortSignal.timeout(config.network.dictionaryTimeoutMs),
    })
    if (!res.ok) return null

    // JSONL, one part of speech per line, most common first. Take the first
    // that actually defines something — a line can carry only inflection
    // notes, which would otherwise win on order alone.
    const entries = (await res.text())
      .split('\n')
      .filter(Boolean)
      .map(line => { try { return JSON.parse(line) as KaikkiEntry } catch { return null } })
      .filter((e): e is KaikkiEntry => e !== null)

    const found = entries
      .map(entry => ({ entry, gloss: pickGloss(entry.senses ?? []) }))
      .find((c): c is { entry: KaikkiEntry; gloss: string } => c.gloss !== null)

    if (!found) return null
    const { entry, gloss } = found

    const sounds = entry.sounds ?? []
    const phonetic = sounds.find(s => s.ipa)?.ipa ?? null
    const audioUrl = sounds.find(s => s.mp3_url)?.mp3_url ?? null

    // Sense-level synonyms describe the sense that was chosen, so they lead;
    // the entry-level ones cover every sense and are the weaker match.
    const senseSynonyms = (entry.senses ?? []).flatMap(s => s.synonyms ?? [])
    const synonyms = Array.from(
      new Set(
        [...senseSynonyms, ...(entry.synonyms ?? [])]
          .map(s => s.word)
          .filter((w): w is string => Boolean(w)),
      ),
    ).slice(0, config.word.maxSynonyms)

    const pos = entry.pos ?? null

    return {
      phonetic,
      partOfSpeech: pos && (PART_OF_SPEECH_NAMES[pos] ?? pos),
      rawDefinition: gloss,
      synonyms,
      audioUrl,
    }
  } catch {
    return null
  }
}
