import Link from 'next/link'
import type { UserWord } from '@/types'

export default function WordCard({ word }: { word: UserWord }) {
  return (
    <Link href={`/search/${encodeURIComponent(word.word)}`}>
      <div className="bg-white rounded-3xl p-5 border-2 border-yellow-100 hover:border-orange-300 transition-colors shadow-sm flex gap-4 items-start">
        {word.comicImageUrl && (
          <img
            src={word.comicImageUrl}
            alt={word.word}
            className="w-24 h-14 object-cover rounded-2xl flex-shrink-0"
          />
        )}
        <div className="min-w-0">
          <h3 className="font-fredoka text-2xl text-orange-400">{word.word}</h3>
          <p className="font-nunito text-gray-600 truncate">{word.definition}</p>
        </div>
      </div>
    </Link>
  )
}
