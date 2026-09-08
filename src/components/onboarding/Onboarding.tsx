'use client'

import { useCallback, useEffect, useState } from 'react'
import { config } from '@/config'
import { AgePicker } from './AgePicker'
import { Tour } from './Tour'

type Stage = 'loading' | 'picker' | 'tour' | 'done'

/**
 * Runs the first-launch experience: reading level, then the tour.
 *
 * Starts in `loading` and renders nothing until localStorage has been read.
 * Guessing "never seen" during server rendering would flash the picker over
 * the home page of every returning visitor before hydration corrected it.
 *
 * Completion is written only when the tour ends, so a visitor who closes the
 * tab mid-tour gets it again — losing the walkthrough to a stray reload is
 * worse than seeing one extra step.
 */
export function Onboarding() {
  const [stage, setStage] = useState<Stage>('loading')

  useEffect(() => {
    setStage(localStorage.getItem(config.storage.onboardingKey) ? 'done' : 'picker')
  }, [])

  const finish = useCallback(() => {
    localStorage.setItem(config.storage.onboardingKey, '1')
    setStage('done')
  }, [])

  if (stage === 'picker') return <AgePicker onChosen={() => setStage('tour')} />
  if (stage === 'tour') return <Tour onFinish={finish} />
  return null
}
