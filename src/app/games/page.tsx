import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { config } from '@/config'

export default async function GamesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/signin')

  const { count } = await supabase
    .from('user_words')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)

  const wordCount = count ?? 0
  const hasEnough = wordCount >= config.games.minWordsRequired

  return (
    <main className="min-h-screen p-6 max-w-2xl mx-auto space-y-6">
      <h1 className="font-fredoka text-4xl text-orange-400">Games</h1>

      {!hasEnough && (
        <div className="bg-yellow-100 border-2 border-yellow-300 rounded-3xl p-5">
          <p className="font-nunito text-gray-700">
            You need at least <strong>{config.games.minWordsRequired} saved words</strong> to play.
            You have {wordCount} so far.{' '}
            <Link href="/" className="text-orange-400 hover:underline">Search for more words!</Link>
          </p>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        <Link href={hasEnough ? '/games/quiz' : '#'}>
          <div className={`bg-white rounded-3xl p-8 border-2 text-center transition-colors ${hasEnough ? 'border-yellow-200 hover:border-orange-300' : 'border-gray-100 opacity-50'}`}>
            <div className="text-5xl mb-3">🧠</div>
            <h2 className="font-fredoka text-2xl text-orange-400">Word Quiz</h2>
            <p className="font-nunito text-gray-500 mt-1">Match words to their meanings</p>
          </div>
        </Link>
        <Link href={hasEnough ? '/games/crossword' : '#'}>
          <div className={`bg-white rounded-3xl p-8 border-2 text-center transition-colors ${hasEnough ? 'border-yellow-200 hover:border-orange-300' : 'border-gray-100 opacity-50'}`}>
            <div className="text-5xl mb-3">✏️</div>
            <h2 className="font-fredoka text-2xl text-orange-400">Crossword</h2>
            <p className="font-nunito text-gray-500 mt-1">Spell words from clues</p>
          </div>
        </Link>
      </div>

      <Link href="/dictionary" className="block text-center font-nunito text-gray-400 hover:text-orange-400 transition-colors">
        ← Back to My Dictionary
      </Link>
    </main>
  )
}
