'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function SignInPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      router.push('/')
      router.refresh()
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-yellow-50 p-4">
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-lg p-8">
        <h1 className="font-fredoka text-3xl text-center text-orange-500 mb-6">Welcome back!</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            className="w-full rounded-2xl border-2 border-yellow-200 px-4 py-3 font-nunito text-lg focus:border-orange-400 focus:outline-none"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            className="w-full rounded-2xl border-2 border-yellow-200 px-4 py-3 font-nunito text-lg focus:border-orange-400 focus:outline-none"
          />
          {error && <p className="text-red-500 font-nunito text-sm">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-orange-400 hover:bg-orange-500 text-white font-fredoka text-xl rounded-2xl py-3 transition-colors disabled:opacity-50"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
        <p className="text-center font-nunito text-gray-500 mt-4">
          No account?{' '}
          <Link href="/auth/signup" className="text-orange-400 hover:underline">Sign up</Link>
        </p>
      </div>
    </main>
  )
}
