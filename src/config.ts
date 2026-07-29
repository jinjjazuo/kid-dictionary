/**
 * Every tuneable value in the application.
 *
 * Nothing here may be duplicated as a literal elsewhere in the codebase.
 * If you are about to type a number or string someone might want to change,
 * it belongs in this file.
 */

export type AgeGroup = '4-6' | '7-10'

export const config = {
  ageGroups: {
    young: { label: '4-6' as AgeGroup, sceneCount: 3 },
    older: { label: '7-10' as AgeGroup, sceneCount: 5 },
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

  word: {
    maxInputLength: 50,
    maxSynonyms: 4,
    maxExamples: 2,
  },

  storage: {
    /** Versioned so a future shape change cannot crash returning users. */
    wordsKey: 'kd.words.v1',
    ageGroupKey: 'kd.ageGroup.v1',
  },

  network: {
    /**
     * A hung outbound call (dictionary API, Gemini, Qwen) must degrade to
     * null and let its step's cache-or-not rule apply, rather than eating
     * the word route's own 60s budget — that would kill the request before
     * the text is cached and make a slow word permanently uncacheable.
     */
    requestTimeoutMs: 20000,
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
