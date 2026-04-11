export type AgeGroup = '4-6' | '7-10'

export const config = {
  ageGroups: {
    young: { label: '4-6' as AgeGroup, sceneCount: 3 },
    older: { label: '7-10' as AgeGroup, sceneCount: 5 },
  },
  ai: {
    model: 'claude-haiku-4-5-20251001',
    imageModel: 'black-forest-labs/flux-schnell',
  },
  games: {
    minWordsRequired: 4,
    mcqChoices: 4,
    quizQuestionCount: 10,
  },
  word: {
    maxInputLength: 50,
    maxSynonyms: 4,
  },
} as const

export function getAgeGroupConfig(ageGroup: AgeGroup) {
  return ageGroup === '7-10' ? config.ageGroups.older : config.ageGroups.young
}
