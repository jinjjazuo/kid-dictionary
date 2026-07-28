import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { UserWord } from '@/types'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('user_words')
    .select(`
      id,
      added_at,
      words (
        id, word, definition, examples, synonyms,
        phonetic, pronunciation_url, comic_image_url
      )
    `)
    .eq('user_id', user.id)
    .order('added_at', { ascending: false })

  if (error) return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 })

  type UserWordRow = {
    id: string
    added_at: string
    words: {
      id: string; word: string; definition: string; examples: string[] | null
      synonyms: string[] | null; phonetic: string | null
      pronunciation_url: string | null; comic_image_url: string | null
    }
  }
  const words: UserWord[] = (data ?? []).map((row: UserWordRow) => ({
    id: row.id,
    wordId: row.words.id,
    word: row.words.word,
    definition: row.words.definition,
    examples: row.words.examples ?? [],
    synonyms: row.words.synonyms ?? [],
    phonetic: row.words.phonetic ?? null,
    pronunciationUrl: row.words.pronunciation_url ?? null,
    comicImageUrl: row.words.comic_image_url ?? null,
    addedAt: row.added_at,
  }))

  return NextResponse.json({ words })
}
