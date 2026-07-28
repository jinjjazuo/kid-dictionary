'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { generateQuizQuestions } from '@/lib/quiz'
import type { SavedWord } from '@/lib/store/types'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'

/**
 * A round of multiple-choice questions over the user's collection.
 *
 * Questions are generated once per round via useMemo. Regenerating on render
 * would reshuffle the choices under the child's finger mid-question.
 *
 * A wrong answer reveals the correct one and moves on rather than allowing a
 * retry, so the score means something and the round always ends.
 */
export function QuizGame({ words }: { words: SavedWord[] }) {
  const [round, setRound] = useState(0)
  const questions = useMemo(() => generateQuizQuestions(words), [words, round])

  const [index, setIndex] = useState(0)
  const [chosen, setChosen] = useState<number | null>(null)
  const [score, setScore] = useState(0)

  const question = questions[index]
  const finished = index >= questions.length

  function choose(choiceIndex: number) {
    // Ignore taps after the first: the answer is already revealed.
    if (chosen !== null) return
    setChosen(choiceIndex)
    if (choiceIndex === question.answerIndex) setScore(s => s + 1)
  }

  function next() {
    setChosen(null)
    setIndex(i => i + 1)
  }

  function playAgain() {
    setIndex(0)
    setChosen(null)
    setScore(0)
    setRound(r => r + 1)
  }

  if (finished) {
    const perfect = score === questions.length
    return (
      <Card className="mx-auto max-w-md">
        <CardContent className="text-center">
          <h2 className="mb-2 font-fredoka text-3xl font-bold">
            {perfect ? 'Perfect!' : 'Well done!'}
          </h2>
          <p className="mb-6 font-nunito text-xl">
            You got <span className="font-bold text-primary">{score}</span> out of{' '}
            {questions.length}.
          </p>
          <div className="flex justify-center gap-3">
            <Button variant="playful" onClick={playAgain}>Play again</Button>
            <Link href="/dictionary"><Button variant="outline">My words</Button></Link>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="mx-auto max-w-2xl">
      <CardContent>
        <p className="mb-4 font-nunito text-sm text-muted-foreground">
          Question {index + 1} of {questions.length}
        </p>

        <h2 className="mb-6 font-fredoka text-2xl font-bold">
          {question.mode === 'word-to-meaning'
            ? <>What does <span className="text-primary">{question.prompt}</span> mean?</>
            : <>Which word means: <span className="text-primary">{question.prompt}</span></>}
        </h2>

        <div className="space-y-2">
          {question.choices.map((choice, i) => {
            const isAnswer = i === question.answerIndex
            const isChosen = i === chosen
            // Colour only appears after an answer, so it never hints.
            const state =
              chosen === null ? 'border-border bg-card hover:border-primary hover:bg-primary/5'
              : isAnswer ? 'border-mint bg-mint/20'
              : isChosen ? 'border-coral bg-coral/20 animate-shake'
              : 'border-border bg-card opacity-60'

            return (
              <button
                key={i}
                onClick={() => choose(i)}
                disabled={chosen !== null}
                className={`w-full min-h-[3rem] rounded-lg border-2 p-4 text-left font-nunito text-lg transition-all ${state}`}
              >
                {choice}
              </button>
            )
          })}
        </div>

        {chosen !== null && (
          <div className="mt-6 flex items-center justify-between gap-4">
            <p className="font-nunito font-bold">
              {chosen === question.answerIndex ? 'Correct!' : 'The right answer is highlighted.'}
            </p>
            <Button variant="playful" onClick={next}>
              {index === questions.length - 1 ? 'See my score' : 'Next'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
