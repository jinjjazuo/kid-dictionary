'use client'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { QuizQuestion } from '@/types'

interface Props {
  questions: QuizQuestion[]
  onComplete: (score: number, total: number) => void
}

export default function QuizGame({ questions, onComplete }: Props) {
  const [current, setCurrent] = useState(0)
  const [selected, setSelected] = useState<number | null>(null)
  const [score, setScore] = useState(0)

  const question = questions[current]
  const isAnswered = selected !== null
  const isCorrect = selected === question.answerIndex

  function handleSelect(index: number) {
    if (isAnswered) return
    setSelected(index)
    if (index === question.answerIndex) setScore(s => s + 1)
  }

  function handleNext() {
    if (current + 1 >= questions.length) {
      onComplete(score + (isCorrect ? 1 : 0), questions.length)
    } else {
      setCurrent(c => c + 1)
      setSelected(null)
    }
  }

  function buttonColors(index: number): string {
    if (!isAnswered) return 'bg-white border-yellow-200 hover:border-orange-300 text-gray-700'
    if (index === question.answerIndex) return 'bg-green-100 border-green-400 text-green-800'
    if (index === selected) return 'bg-red-100 border-red-400 text-red-800'
    return 'bg-white border-yellow-200 text-gray-400'
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={current}
        initial={{ opacity: 0, x: 40 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -40 }}
        className="space-y-6"
      >
        <div className="flex justify-between font-nunito text-gray-400">
          <span>Question {current + 1} of {questions.length}</span>
          <span>Score: {score}</span>
        </div>

        <div className="bg-white rounded-3xl p-6 border-2 border-yellow-100 shadow-sm">
          <p className="font-nunito text-sm text-gray-400 mb-2">
            {question.mode === 'word-to-meaning' ? 'What does this word mean?' : 'Which word matches this meaning?'}
          </p>
          <p className="font-fredoka text-3xl text-orange-400">{question.prompt}</p>
        </div>

        <div className="space-y-3">
          {question.choices.map((choice, i) => (
            <motion.button
              key={i}
              onClick={() => handleSelect(i)}
              whileTap={!isAnswered ? { scale: 0.97 } : {}}
              className={`w-full text-left rounded-2xl px-5 py-4 border-2 font-nunito text-lg transition-colors ${buttonColors(i)}`}
            >
              {choice}
              {isAnswered && i === question.answerIndex && ' ✓'}
            </motion.button>
          ))}
        </div>

        {isAnswered && (
          <button
            onClick={handleNext}
            className="w-full bg-orange-400 hover:bg-orange-500 text-white font-fredoka text-xl rounded-2xl py-4 transition-colors"
          >
            {current + 1 >= questions.length ? 'See Results!' : 'Next →'}
          </button>
        )}
      </motion.div>
    </AnimatePresence>
  )
}
