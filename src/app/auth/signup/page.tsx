'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { AgeGroup } from '@/types'

export default function SignUpPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [ageGroup, setAgeGroup] = useState<AgeGroup>('4-6')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { age_group: ageGroup } },
    })
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
        <h1 className="font-fredoka text-3xl text-center text-orange-500 mb-2">Join the fun!</h1>
        <p className="font-nunito text-center text-gray-500 mb-6">Create your word adventure</p>
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
          <div>
            <p className="font-nunito text-gray-600 mb-2">How old are you?</p>
            <div className="grid grid-cols-2 gap-3">
              {(['4-6', '7-10'] as AgeGroup[]).map(group => (
                <button
                  key={group}
                  type="button"
                  onClick={() => setAgeGroup(group)}
                  className={`rounded-2xl py-3 font-fredoka text-lg border-2 transition-colors ${
                    ageGroup === group
                      ? 'bg-orange-400 text-white border-orange-400'
                      : 'border-yellow-200 text-gray-600 hover:border-orange-300'
                  }`}
                >
                  {group === '4-6' ? '4 – 6' : '7 – 10'}
                </button>
              ))}
            </div>
          </div>
          {error && <p className="text-red-500 font-nunito text-sm">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-orange-400 hover:bg-orange-500 text-white font-fredoka text-xl rounded-2xl py-3 transition-colors disabled:opacity-50"
          >
            {loading ? 'Creating account...' : "Let's Go!"}
          </button>
        </form>
        <p className="text-center font-nunito text-gray-500 mt-4">
          Have an account?{' '}
          <Link href="/auth/signin" className="text-orange-400 hover:underline">Sign in</Link>
        </p>
      </div>
    </main>
  )
}
