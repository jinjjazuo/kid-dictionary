import { NextResponse } from 'next/server'
import { lookupWord } from '@/lib/word-pipeline'
import { config } from '@/config'
import type { AgeGroup } from '@/types'

export async function GET(
  request: Request,
  { params }: { params: { word: string } }
) {
  const { searchParams } = new URL(request.url)
  const rawAgeGroup = searchParams.get('ageGroup')
  const ageGroup: AgeGroup = rawAgeGroup === '7-10' ? '7-10' : '4-6'
  const word = params.word.toLowerCase().trim().slice(0, config.word.maxInputLength)
  if (!word) return NextResponse.json({ error: 'Word is required' }, { status: 400 })

  const result = await lookupWord(word, ageGroup)
  if (!result.found) return NextResponse.json({ error: 'Word not found' }, { status: 404 })
  return NextResponse.json(result.data)
}
