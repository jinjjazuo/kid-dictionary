import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateQuizQuestions } from '@/lib/quiz'
import { config } from '@/config'
import type { UserWord } from '@/types'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const count = Math.min(Number(searchParams.get('count') ?? config.games.quizQuestionCount), 20)

  const { data: rawWords } = await supabase
    .from('user_words')
    .select('id, added_at, words(id, word, definition, examples, synonyms, phonetic, pronunciation_url, comic_image_url)')
    .eq('user_id', user.id)

  const words: UserWord[] = (rawWords ?? []).map((row: any) => ({
    id: row.id, wordId: row.words.id, word: row.words.word,
    definition: row.words.definition, examples: row.words.examples ?? [],
    synonyms: row.words.synonyms ?? [], phonetic: row.words.phonetic ?? null,
    pronunciationUrl: row.words.pronunciation_url ?? null,
    comicImageUrl: row.words.comic_image_url ?? null, addedAt: row.added_at,
  }))

  if (words.length < config.games.minWordsRequired) {
    return NextResponse.json(
      { error: `Need at least ${config.games.minWordsRequired} saved words to play` },
      { status: 400 }
    )
  }

  // Fetch global words for distractor supplements when saved count is small
  let globalWords: UserWord[] = []
  if (words.length <= config.games.mcqChoices) {
    const { data: profile } = await supabase.from('profiles').select('age_group').eq('id', user.id).single()
    const ageGroup = profile?.age_group ?? '4-6'
    const { data: extras } = await supabase
      .from('words')
      .select('id, word, definition, examples, synonyms, phonetic, pronunciation_url, comic_image_url')
      .eq('age_group', ageGroup)
      .limit(20)
    globalWords = (extras ?? []).map((w: any) => ({
      id: '', wordId: w.id, word: w.word, definition: w.definition,
      examples: w.examples ?? [], synonyms: w.synonyms ?? [],
      phonetic: w.phonetic ?? null, pronunciationUrl: w.pronunciation_url ?? null,
      comicImageUrl: w.comic_image_url ?? null, addedAt: '',
    }))
  }

  const questions = generateQuizQuestions(words, count, globalWords)
  return NextResponse.json({ questions })
}
