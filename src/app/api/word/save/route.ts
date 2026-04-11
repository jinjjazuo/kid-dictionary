import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const wordId = body?.wordId
  if (!wordId) return NextResponse.json({ error: 'wordId required' }, { status: 400 })

  const { error } = await supabase
    .from('user_words')
    .insert({ user_id: user.id, word_id: wordId })

  if (error?.code === '23505') {
    // Unique constraint: word already saved
    return NextResponse.json({ success: true }, { status: 409 })
  }
  if (error) return NextResponse.json({ error: 'Failed to save' }, { status: 500 })

  return NextResponse.json({ success: true })
}
