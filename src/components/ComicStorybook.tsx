'use client'
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Scene } from '@/types'

interface Props {
  word: string
  storyScript: Scene[]
  comicImageUrl: string | null
  panelCount: number
}

export default function ComicStorybook({ word, storyScript, comicImageUrl, panelCount }: Props) {
  const [currentScene, setCurrentScene] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)

  function highlightWord(text: string): React.ReactNode {
    const parts = text.split(new RegExp(`(${word})`, 'gi'))
    return parts.map((part, i) =>
      part.toLowerCase() === word.toLowerCase()
        ? <strong key={i} className="text-orange-500 font-fredoka">{part}</strong>
        : part
    )
  }

  function speakScene(index: number) {
    if (!('speechSynthesis' in window)) return
    window.speechSynthesis.cancel()
    const scene = storyScript[index]
    if (!scene) return

    const utterance = new SpeechSynthesisUtterance(scene.text)
    utterance.rate = 0.85
    utterance.onend = () => {
      const next = index + 1
      if (next < storyScript.length) {
        setCurrentScene(next)
        speakScene(next)
      } else {
        setIsPlaying(false)
      }
    }
    window.speechSynthesis.speak(utterance)
  }

  function handlePlay() {
    setCurrentScene(0)
    setIsPlaying(true)
    speakScene(0)
  }

  function handleStop() {
    window.speechSynthesis?.cancel()
    setIsPlaying(false)
  }

  useEffect(() => () => { window.speechSynthesis?.cancel() }, [])

  if (storyScript.length === 0) return null

  const panelWidthPct = 100 / panelCount

  return (
    <div className="space-y-4">
      <h2 className="font-fredoka text-2xl text-orange-400">Story Time!</h2>

      {/* Comic strip image with panel highlight */}
      {comicImageUrl && (
        <div className="relative rounded-3xl overflow-hidden border-4 border-yellow-200 shadow-md">
          <img src={comicImageUrl} alt={`Comic strip for ${word}`} className="w-full" />
          <AnimatePresence mode="wait">
            <motion.div
              key={currentScene}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="absolute inset-y-0 border-4 border-orange-400 bg-orange-400/10 pointer-events-none rounded-sm"
              style={{
                left: `${currentScene * panelWidthPct}%`,
                width: `${panelWidthPct}%`,
              }}
            />
          </AnimatePresence>
        </div>
      )}

      {/* Current scene text */}
      <div className="bg-white rounded-3xl p-5 border-2 border-yellow-100 min-h-[80px] flex items-center">
        <p className="font-nunito text-xl text-gray-700 leading-relaxed">
          {highlightWord(storyScript[currentScene]?.text ?? '')}
        </p>
      </div>

      {/* Controls */}
      <div className="flex gap-3 items-center">
        {!isPlaying ? (
          <button
            onClick={handlePlay}
            className="bg-green-400 hover:bg-green-500 text-white font-fredoka text-xl rounded-2xl px-6 py-3 transition-colors"
          >
            ▶ Play Story
          </button>
        ) : (
          <button
            onClick={handleStop}
            className="bg-gray-300 hover:bg-gray-400 text-gray-700 font-fredoka text-xl rounded-2xl px-6 py-3 transition-colors"
          >
            ■ Stop
          </button>
        )}
        {/* Scene dots */}
        <div className="flex items-center gap-2">
          {storyScript.map((_, i) => (
            <button
              key={i}
              onClick={() => { handleStop(); setCurrentScene(i) }}
              className={`w-3 h-3 rounded-full transition-colors ${i === currentScene ? 'bg-orange-400' : 'bg-gray-300'}`}
              aria-label={`Scene ${i + 1}`}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
