'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import QuizGame from '@/components/games/QuizGame'
import type { QuizQuestion } from '@/types'

export default function QuizPage() {
  const [questions, setQuestions] = useState<QuizQuestion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [result, setResult] = useState<{ score: number; total: number } | null>(null)
  const router = useRouter()

  useEffect(() => {
    fetch('/api/games/quiz')
      .then(r => r.json())
      .then(data => {
        if (data.error) setError(data.error)
        else setQuestions(data.questions)
      })
      .catch(() => setError('Failed to load quiz'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <main className="min-h-screen flex items-center justify-center">
      <p className="font-fredoka text-2xl text-orange-400">Loading quiz...</p>
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

  if (result) return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-6 p-6">
      <h1 className="font-fredoka text-5xl text-orange-400">
        {result.score === result.total ? '🎉 Perfect!' : result.score >= result.total / 2 ? '⭐ Great job!' : '💪 Keep practising!'}
      </h1>
      <p className="font-nunito text-2xl text-gray-600">{result.score} / {result.total}</p>
      <div className="flex gap-4">
        <button
          onClick={() => { setResult(null); setQuestions([]); setLoading(true)
            fetch('/api/games/quiz').then(r => r.json()).then(d => { setQuestions(d.questions); setLoading(false) }) }}
          className="bg-orange-400 hover:bg-orange-500 text-white font-fredoka text-xl rounded-2xl px-6 py-3 transition-colors"
        >
          Play Again
        </button>
        <button onClick={() => router.push('/games')} className="bg-yellow-200 hover:bg-yellow-300 text-gray-700 font-fredoka text-xl rounded-2xl px-6 py-3 transition-colors">
          Other Games
        </button>
      </div>
    </main>
  )

  return (
    <main className="min-h-screen p-6 max-w-lg mx-auto pt-12">
      <h1 className="font-fredoka text-3xl text-orange-400 mb-8">Word Quiz</h1>
      <QuizGame questions={questions} onComplete={(score, total) => setResult({ score, total })} />
    </main>
  )
}
