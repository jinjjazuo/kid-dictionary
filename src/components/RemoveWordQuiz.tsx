'use client'

import { useMemo, useState } from 'react'
import { buildQuestionFor } from '@/lib/quiz'
import type { SavedWord } from '@/lib/store/types'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'

/**
 * Requires a correct answer before a word leaves the collection.
 *
 * Removal is the only destructive action in the application, and the audience
 * is children. Answering a question about the word prevents accidental loss
 * and turns deletion into a moment of recall.
 *
 * When the collection is too small to build a question, removal proceeds with
 * a plain confirmation — a child must never be unable to remove a word.
 */
export function RemoveWordQuiz({
  word,
  allWords,
  onCorrect,
  onCancel,
}: {
  word: SavedWord
  allWords: SavedWord[]
  onCorrect: () => void
  onCancel: () => void
}) {
  // Built once: rebuilding on each render would reshuffle the choices under
  // the child's finger.
  const question = useMemo(
    () => buildQuestionFor(word, allWords, 'word-to-meaning'),
    [word, allWords],
  )
  const [wrongIndex, setWrongIndex] = useState<number | null>(null)

  if (!question) {
    return (
      <Card>
        <CardContent className="text-center">
          <h2 className="mb-4 font-fredoka text-2xl font-bold">
            Remove &ldquo;{word.word}&rdquo;?
          </h2>
          <div className="flex justify-center gap-3">
            <Button variant="outline" onClick={onCancel}>Keep it</Button>
            <Button variant="destructive" onClick={onCorrect}>Remove</Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  function handleAnswer(index: number) {
    if (index === question!.answerIndex) onCorrect()
    else setWrongIndex(index)
  }

  return (
    <Card>
      <CardContent>
        <h2 className="mb-2 font-fredoka text-2xl font-bold">One last question!</h2>
        <p className="mb-6 font-nunito text-muted-foreground">
          Answer correctly to remove &ldquo;{word.word}&rdquo; from your words.
        </p>

        <p className="mb-4 font-fredoka text-xl">
          What does <span className="text-primary">{question.prompt}</span> mean?
        </p>

        <div className="space-y-2">
          {question.choices.map((choice, index) => (
            <button
              key={index}
              onClick={() => handleAnswer(index)}
              className={[
                'w-full rounded-lg border-2 p-4 text-left font-nunito text-lg transition-all',
                'min-h-[3rem] hover:border-primary hover:bg-primary/5',
                wrongIndex === index
                  ? 'border-coral bg-coral/10 animate-shake'
                  : 'border-border bg-card',
              ].join(' ')}
            >
              {choice}
            </button>
          ))}
        </div>

        {wrongIndex !== null && (
          <p className="mt-4 font-nunito text-coral">Not quite — have another go!</p>
        )}

        <Button variant="ghost" onClick={onCancel} className="mt-6 w-full">
          Cancel, keep this word
        </Button>
      </CardContent>
    </Card>
  )
}
