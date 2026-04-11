'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import CrosswordGame from '@/components/games/CrosswordGame'

export default function CrosswordPage() {
  const [words, setWords] = useState<{ word: string; definition: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const router = useRouter()

  useEffect(() => {
    fetch('/api/games/crossword')
      .then(r => r.json())
      .then(data => {
        if (data.error) setError(data.error)
        else setWords(data.words)
      })
      .catch(() => setError('Failed to load crossword'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <main className="min-h-screen flex items-center justify-center">
      <p className="font-fredoka text-2xl text-orange-400">Building crossword...</p>
    </main>
  )

  if (error) return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-4 p-6">
      <p className="font-nunito text-xl text-gray-500">{error}</p>
      <button onClick={() => router.push('/dictionary')} className="text-orange-400 font-nunito hover:underline">
        Add more words first
      </button>
    </main>
  )

  return (
    <main className="min-h-screen p-6 max-w-3xl mx-auto space-y-6">
      <h1 className="font-fredoka text-3xl text-orange-400">Word Crossword</h1>
      <CrosswordGame words={words} />
    </main>
  )
}
