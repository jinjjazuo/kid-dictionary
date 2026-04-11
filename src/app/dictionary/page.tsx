import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import WordCard from '@/components/WordCard'
import Link from 'next/link'
import type { UserWord } from '@/types'

export default async function DictionaryPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/signin')

  // Query directly instead of self-calling the API route
  const { data: rawWords } = await supabase
    .from('user_words')
    .select(`
      id, added_at,
      words (id, word, definition, examples, synonyms, phonetic, pronunciation_url, comic_image_url)
    `)
    .eq('user_id', user.id)
    .order('added_at', { ascending: false })

  const words: UserWord[] = (rawWords ?? []).map((row: any) => ({
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

  return (
    <main className="min-h-screen p-6 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-fredoka text-4xl text-orange-400">My Dictionary</h1>
        <Link href="/games" className="bg-yellow-400 hover:bg-yellow-500 text-white font-fredoka text-lg rounded-2xl px-4 py-2 transition-colors">
          Play Games!
        </Link>
      </div>

      {words.length === 0 ? (
        <div className="text-center py-12">
          <p className="font-nunito text-xl text-gray-400">No words saved yet.</p>
          <Link href="/" className="text-orange-400 font-nunito hover:underline">Search for a word to get started!</Link>
        </div>
      ) : (
        <div className="space-y-3">
          {words.map(word => <WordCard key={word.id} word={word} />)}
        </div>
      )}
    </main>
  )
}
