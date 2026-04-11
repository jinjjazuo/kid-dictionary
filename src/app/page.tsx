import Link from 'next/link'
import SearchBar from '@/components/SearchBar'
import { createClient } from '@/lib/supabase/server'

export default async function HomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 gap-8">
      <div className="text-center">
        <h1 className="font-fredoka text-5xl md:text-7xl text-orange-400 mb-2">
          Word World
        </h1>
        <p className="font-nunito text-xl text-gray-500">
          Search any word and watch it come to life!
        </p>
      </div>

      <SearchBar />

      <div className="flex gap-4 font-nunito text-gray-500">
        {user ? (
          <>
            <Link href="/dictionary" className="hover:text-orange-400 transition-colors">My Dictionary</Link>
            <span>·</span>
            <Link href="/games" className="hover:text-orange-400 transition-colors">Games</Link>
          </>
        ) : (
          <>
            <Link href="/auth/signin" className="hover:text-orange-400 transition-colors">Sign In</Link>
            <span>·</span>
            <Link href="/auth/signup" className="hover:text-orange-400 transition-colors">Sign Up</Link>
          </>
        )}
      </div>
    </main>
  )
}
