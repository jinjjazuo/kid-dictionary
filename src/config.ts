/**
 * Every tuneable value in the application.
 *
 * Nothing here may be duplicated as a literal elsewhere in the codebase.
 * If you are about to type a number or string someone might want to change,
 * it belongs in this file.
 */

export type AgeGroup = '4-6' | '7-10'

export const config = {
  /**
   * The two reading levels, with the ages each one covers.
   *
   * The bands must stay adjacent and gapless — `young.maxAge + 1` is
   * `older.minAge` — because the picker offers every age between the outer
   * bounds and `ageGroupForAge` splits them at the young band's top. A gap
   * would leave a real child with a button that maps nowhere sensible.
   *
   * The labels are DB check constraints. Widening a band is safe; renaming a
   * label is not.
   */
  ageGroups: {
    young: { label: '4-6' as AgeGroup, sceneCount: 3, minAge: 4, maxAge: 6 },
    older: { label: '7-10' as AgeGroup, sceneCount: 5, minAge: 7, maxAge: 10 },
  },

  /** Used when a visitor has not chosen an age group. */
  defaultAgeGroup: '4-6' as AgeGroup,

  /**
   * Bumping a version makes existing cache rows invisible to lookups, so
   * content regenerates lazily on next search — one word at a time, with no
   * migration script and no bulk regeneration bill.
   *
   * Text and image are independent because their costs differ by orders of
   * magnitude. Image generation is rate-limited at roughly 500 per day, so a
   * combined version would mean that fixing one word of a definition prompt
   * redraws every comic in the cache.
   */
  content: {
    textVersion: 2,
    imageVersion: 1,
  },

  ai: {
    /** gemini | qwen — selected by the AI_PROVIDER environment variable. */
    provider: process.env.AI_PROVIDER ?? 'gemini',
    gemini: {
      /**
       * Uses the flash-lite -latest alias to track Google's current lite model.
       * Direct version names (e.g., gemini-2.5-flash) rot as Google renames
       * generations. Lite is chosen over flash for its 25x larger free daily
       * quota (500 vs 20 requests/day) — a kids-dictionary definition is well
       * within a lite model's ability.
       */
      textModel: 'gemini-flash-lite-latest',
      /**
       * Image model requires a billing-enabled key. Free tier has no image quota
       * as of 2026-07. The pipeline caches comic_image_url as null when generation
       * fails, resulting in text-only entries.
       */
      imageModel: 'gemini-2.5-flash-image',
    },
    qwen: {
      textModel: 'qwen-plus',
    },
  },

  images: {
    format: 'webp' as const,
    /**
     * Quality 80 is roughly an eighth the size of the source PNG with no
     * visible difference on a tablet. That ratio is what keeps the app inside
     * Supabase Storage's 1 GB free tier: ~6,600 comics fit instead of ~830.
     */
    quality: 80,
    /** One year. Comics are immutable once generated. */
    cacheSeconds: 31536000,
  },

  games: {
    minWordsRequired: 4,
    /**
     * Must not exceed minWordsRequired. A question needs mcqChoices - 1 wrong
     * answers and they come only from the user's other saved words, so raising
     * this above the minimum makes a question unbuildable at the minimum
     * collection size.
     */
    mcqChoices: 4,
    /** An upper bound. The actual count is capped at the collection size. */
    quizQuestionCount: 10,
  },

  /**
   * Source of the raw entry that gates every billable step.
   *
   * kaikki.org publishes Wiktionary parsed into JSON by the Wiktextract
   * project. Wiktionary itself only exposes wikitext templates
   * ({{IPA|en|...}}, {{syn|en|iris}}), so going direct would mean owning a
   * template parser that breaks whenever Wiktionary reshuffles a template.
   * This gives the same data already structured, including a resolved mp3.
   */
  dictionary: {
    /** Paths sit under <first letter>/<first two letters>/<word>.jsonl. */
    baseUrl: 'https://kaikki.org/dictionary/English/meaning',
    /**
     * kaikki does not currently require one, but Wikimedia — where the audio
     * is actually hosted — returns 403 without it. Sent on both for
     * consistency and so the traffic is attributable if it ever misbehaves.
     */
    userAgent: 'kid-dictionary/0.1 (educational word app for children)',
    /**
     * Wiktionary orders senses historically, not by how common they are, so
     * 'enormous' leads with the obsolete "deviating from the norm". Feeding
     * that to the model teaches a child the wrong meaning. These tags are
     * skipped when picking a sense; the last four are a safety filter rather
     * than a quality one.
     */
    excludedSenseTags: [
      'obsolete', 'archaic', 'dated', 'rare',
      'vulgar', 'offensive', 'derogatory', 'slang',
    ],
  },

  word: {
    maxInputLength: 50,
    maxSynonyms: 4,
    maxExamples: 2,
  },

  storage: {
    /** Versioned so a future shape change cannot crash returning users. */
    wordsKey: 'kd.words.v1',
    ageGroupKey: 'kd.ageGroup.v1',
    /**
     * Set once the first-launch age picker and tour have been dismissed.
     * Versioned like the others: bumping it re-runs onboarding for everyone,
     * which is the only way to reintroduce a tour step to existing visitors.
     */
    onboardingKey: 'kd.onboarded.v1',
  },

  network: {
    /**
     * A hung AI call (Gemini, Qwen) must degrade to null and let its step's
     * cache-or-not rule apply, rather than eating the word route's own 60s
     * budget — that would kill the request before the text is cached and make
     * a slow word permanently uncacheable.
     */
    requestTimeoutMs: 20000,
    /**
     * kaikki answers a known word in about a second, and a cold one in under
     * four, so this is headroom rather than a workaround — unlike the 3s it
     * held when the source was dictionaryapi.dev, which hung until Cloudflare
     * gave up with a 522 at around 20 seconds.
     *
     * It is deliberately not requestTimeoutMs. A generation call needs the
     * full 20s, and sharing one number made every misspelling — the most
     * likely input from a four-year-old — cost 20 seconds of spinner before
     * "Hmm, we don't know that word!".
     */
    dictionaryTimeoutMs: 5000,
  },
} as const

/**
 * Resolves an age group label to its settings.
 *
 * Anything other than '7-10' resolves to the younger group, so an unknown or
 * corrupted stored value degrades to the safer, simpler content rather than
 * throwing.
 */
export function getAgeGroupConfig(ageGroup: AgeGroup) {
  return ageGroup === '7-10' ? config.ageGroups.older : config.ageGroups.young
}

/**
 * Maps a child's own answer to "How old are you?" onto a reading level.
 *
 * Onboarding asks for an age rather than a band because a five-year-old knows
 * how old they are and has no idea which of two ranges they belong to. The
 * bands are adjacent, so the young group's upper bound is the only boundary
 * this needs — an age past the older band still resolves to it rather than to
 * nothing.
 */
export function ageGroupForAge(age: number): AgeGroup {
  return age <= config.ageGroups.young.maxAge
    ? config.ageGroups.young.label
    : config.ageGroups.older.label
}

/**
 * Every age the picker offers, ascending.
 *
 * Derived from the band bounds rather than written out, so widening a band
 * widens the picker with it and cannot strand an age with no button to press.
 */
export function pickableAges(): number[] {
  const { minAge } = config.ageGroups.young
  const { maxAge } = config.ageGroups.older
  return Array.from({ length: maxAge - minAge + 1 }, (_, index) => minAge + index)
}
