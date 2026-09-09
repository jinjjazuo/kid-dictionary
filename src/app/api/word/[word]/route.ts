import { NextResponse } from 'next/server'
import { config } from '@/config'
import { lookupWord } from '@/lib/word-pipeline'
import type { AgeGroup } from '@/types'

/**
 * The application's only API route.
 *
 * It exists because the browser cannot hold the AI key or the Supabase
 * service-role key, and cannot run sharp. Everything else — saving, reading
 * the collection, both games — happens client-side against localStorage.
 *
 * Generation can take around ten seconds on a cache miss, so the timeout is
 * raised above the platform default. This route waits for the whole pipeline
 * including the comic; the streamed word page is what gives a human the
 * definition early.
 */
export const maxDuration = 60

export async function GET(
  request: Request,
  { params }: { params: { word: string } },
) {
  const decoded = decodeURIComponent(params.word)

  const requested = new URL(request.url).searchParams.get('ageGroup')
  const ageGroup: AgeGroup =
    requested === '7-10' || requested === '4-6' ? requested : config.defaultAgeGroup

  try {
    const result = await lookupWord(decoded, ageGroup)

    if (!result.found) {
      // Unknown and blocked words share a response. Telling a child which
      // words are blocked would invite them to go looking.
      return NextResponse.json(
        { error: "Hmm, we don't know that word!" },
        { status: 404 },
      )
    }

    // Plain JSON has no way to send a pending value, so unlike the page
    // this must wait for the comic and fold the URL in. Without it every
    // cache-miss response would claim the word has no comic.
    return NextResponse.json({ ...result.data, comicImageUrl: await result.comic })
  } catch {
    return NextResponse.json(
      { error: 'Something went wrong. Please try again!' },
      { status: 500 },
    )
  }
}
