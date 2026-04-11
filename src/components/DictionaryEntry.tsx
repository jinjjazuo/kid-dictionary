'use client'
import { useRef } from 'react'
import Link from 'next/link'
import type { WordData } from '@/types'

export default function DictionaryEntry({ data }: { data: WordData }) {
  const audioRef = useRef<HTMLAudioElement>(null)

  return (
    <div className="space-y-6">
      {/* Word + pronunciation */}
      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="font-fredoka text-5xl text-orange-400">{data.word}</h1>
        {data.phonetic && (
          <span className="font-nunito text-lg text-gray-400">{data.phonetic}</span>
        )}
        {data.pronunciationUrl && (
          <>
            <button
              onClick={() => audioRef.current?.play()}
              className="bg-yellow-200 hover:bg-yellow-300 rounded-full p-2 transition-colors"
              aria-label="Hear pronunciation"
            >
              🔊
            </button>
            <audio ref={audioRef} src={data.pronunciationUrl} />
          </>
        )}
      </div>

      {/* Definition */}
      <div className="bg-white rounded-3xl p-6 shadow-sm border-2 border-yellow-100">
        <p className="font-nunito text-xl text-gray-700 leading-relaxed">{data.definition}</p>
      </div>

      {/* Examples */}
      {data.examples.length > 0 && (
        <div className="space-y-2">
          <h2 className="font-fredoka text-xl text-gray-500">Examples</h2>
          {data.examples.map((ex, i) => (
            <p key={i} className="font-nunito text-lg text-gray-600 italic border-l-4 border-yellow-300 pl-4">
              {ex}
            </p>
          ))}
        </div>
      )}

      {/* Synonyms */}
      {data.synonyms.length > 0 && (
        <div className="space-y-2">
          <h2 className="font-fredoka text-xl text-gray-500">Similar words</h2>
          <div className="flex flex-wrap gap-2">
            {data.synonyms.map(syn => (
              <Link
                key={syn}
                href={`/search/${encodeURIComponent(syn)}`}
                className="bg-blue-100 hover:bg-blue-200 text-blue-700 font-nunito text-lg rounded-2xl px-4 py-1 transition-colors"
              >
                {syn}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
