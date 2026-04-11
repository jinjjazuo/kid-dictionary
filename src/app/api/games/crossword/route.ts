import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { config } from '@/config'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: rawWords } = await supabase
    .from('user_words')
    .select('words(word, definition)')
    .eq('user_id', user.id)

  const words = (rawWords ?? []).map((row: any) => ({
    word: row.words.word as string,
    definition: row.words.definition as string,
  }))

  if (words.length < config.games.minWordsRequired) {
    return NextResponse.json(
      { error: `Need at least ${config.games.minWordsRequired} saved words to play` },
      { status: 400 }
    )
  }

  return NextResponse.json({ words })
}
