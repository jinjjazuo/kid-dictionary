'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function SearchBar({ initialValue = '' }: { initialValue?: string }) {
  const [query, setQuery] = useState(initialValue)
  const router = useRouter()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const word = query.trim().toLowerCase()
    if (word) router.push(`/search/${encodeURIComponent(word)}`)
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 w-full max-w-lg">
      <input
        type="text"
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="Search a word..."
        maxLength={50}
        className="flex-1 rounded-2xl border-2 border-yellow-300 bg-white px-5 py-4 font-nunito text-xl focus:border-orange-400 focus:outline-none shadow-sm"
      />
      <button
        type="submit"
        className="bg-orange-400 hover:bg-orange-500 text-white font-fredoka text-xl rounded-2xl px-6 py-4 transition-colors shadow-sm min-w-[120px]"
      >
        Search!
      </button>
    </form>
  )
}
