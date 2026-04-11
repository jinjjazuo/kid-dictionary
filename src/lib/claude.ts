import Anthropic from '@anthropic-ai/sdk'
import { config, getAgeGroupConfig } from '@/config'
import type { AgeGroup, Scene } from '@/types'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export function buildEnrichmentPrompt(
  word: string,
  rawDefinition: string,
  ageGroup: AgeGroup
): string {
  const isYoung = ageGroup === '4-6'
  const ageDesc = isYoung ? '5-year-old' : '9-year-old'
  const instruction = isYoung
    ? 'Simplify this definition for a 5-year-old in one short sentence using only simple words.'
    : 'Rewrite this definition clearly for a 9-year-old in one sentence.'

  return `${instruction}
Definition: "${rawDefinition}"
Then write 2 example sentences using the word "${word}" that a ${ageDesc} would understand.
Output ONLY valid JSON in this exact format: {"definition": "...", "examples": ["...", "..."]}`
}

export function buildStoryPrompt(word: string, ageGroup: AgeGroup): string {
  const { sceneCount } = getAgeGroupConfig(ageGroup)
  const isYoung = ageGroup === '4-6'
  const ageDesc = isYoung ? '5-year-old' : '9-year-old'
  const instruction = isYoung
    ? `Write a fun, silly ${sceneCount}-scene story for a ${ageDesc} using the word "${word}". Use only simple words.`
    : `Write a ${sceneCount}-scene story for a ${ageDesc} using the word "${word}". Include context that makes the meaning clear.`

  return `${instruction}
The word "${word}" must appear highlighted in at least one scene.
Output ONLY valid JSON in this exact format: [{"scene": 1, "text": "..."}, {"scene": 2, "text": "..."}]`
}

export function buildComicImagePrompt(scenes: Scene[], panelCount: number): string {
  const panelDescriptions = scenes
    .map(s => `Panel ${s.scene}: ${s.text}`)
    .join(' ')

  return `A comic strip with exactly ${panelCount} equal-width vertical panels side by side, no borders between panels, flat illustration style, bright colours, child-friendly cartoon art. ${panelDescriptions}`
}

export function parseJsonResponse(text: string): any | null {
  // Strip markdown code blocks if present
  const stripped = text.replace(/```(?:json)?\n?/g, '').replace(/```/g, '').trim()
  try {
    return JSON.parse(stripped)
  } catch {
    return null
  }
}

export async function enrichWord(
  word: string,
  rawDefinition: string,
  ageGroup: AgeGroup
): Promise<{ definition: string; examples: string[] } | null> {
  const prompt = buildEnrichmentPrompt(word, rawDefinition, ageGroup)
  try {
    const message = await anthropic.messages.create({
      model: config.ai.model,
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }],
    })
    const text = message.content[0].type === 'text' ? message.content[0].text : ''
    const parsed = parseJsonResponse(text)
    if (!parsed?.definition || !Array.isArray(parsed?.examples)) return null
    return { definition: parsed.definition, examples: parsed.examples.slice(0, 2) }
  } catch {
    return null
  }
}

export async function generateStoryScript(
  word: string,
  ageGroup: AgeGroup
): Promise<Scene[] | null> {
  const prompt = buildStoryPrompt(word, ageGroup)
  try {
    const message = await anthropic.messages.create({
      model: config.ai.model,
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }],
    })
    const text = message.content[0].type === 'text' ? message.content[0].text : ''
    const parsed = parseJsonResponse(text)
    if (!Array.isArray(parsed)) return null
    return parsed as Scene[]
  } catch {
    return null
  }
}
