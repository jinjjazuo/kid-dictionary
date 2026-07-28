'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Props { wordId: string | null }

export default function AddToDictionaryButton({ wordId }: Props) {
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(false)
  const [user, setUser] = useState<{ id: string } | null>(null)
  const router = useRouter()
  const supabaseRef = useRef(createClient())

  useEffect(() => {
    supabaseRef.current.auth.getUser().then(({ data: { user } }) => setUser(user))
  }, [])

  async function handleClick() {
    if (!user) {
      router.push('/auth/signup')
      return
    }
    if (!wordId || saved || loading) return
    setLoading(true)
    const res = await fetch('/api/word/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wordId }),
    })
    if (res.ok || res.status === 409) setSaved(true)
    setLoading(false)
  }

  if (saved) {
    return (
      <div className="bg-green-100 text-green-700 font-fredoka text-xl rounded-2xl px-6 py-3 border-2 border-green-200">
        ✓ In My Dictionary
      </div>
    )
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading || !wordId}
      className="bg-yellow-400 hover:bg-yellow-500 text-white font-fredoka text-xl rounded-2xl px-6 py-3 transition-colors disabled:opacity-50"
    >
      {loading ? 'Saving...' : user ? '+ Add to My Dictionary' : '+ Save Word (Sign Up)'}
    </button>
  )
}
