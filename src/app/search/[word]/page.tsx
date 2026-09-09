import Link from 'next/link'
import { Suspense } from 'react'
import { config } from '@/config'
import { lookupWord } from '@/lib/word-pipeline'
import { ComicStrip } from '@/components/ComicStrip'
import { DictionaryEntry } from '@/components/DictionaryEntry'
import { SaveWord } from '@/components/SaveWord'
import { SearchBar } from '@/components/SearchBar'
import { Card, CardContent } from '@/components/ui/Card'
import type { AgeGroup, WordData } from '@/types'

/**
 * The half of the page that waits on the image model.
 *
 * It is its own async component purely so it can sit inside a Suspense
 * boundary — that is what lets the definition above it reach the screen while
 * this is still awaiting a comic that takes tens of seconds to draw.
 */
async function Comic({ data, comic }: { data: WordData; comic: Promise<string | null> }) {
  const comicImageUrl = await comic
  return (
    <>
      <ComicStrip word={data.word} imageUrl={comicImageUrl} scenes={data.storyScript} />
      <SaveWord data={{ ...data, comicImageUrl }} />
    </>
  )
}

/**
 * A server component, so generation happens on the server and no key reaches
 * the browser. The definition is awaited and rendered; the comic streams in
 * afterwards under a Suspense boundary, because making a child wait tens of
 * seconds to read what a word means is worse than making them wait for the
 * picture.
 *
 * The age group comes from the query string rather than localStorage because
 * this component cannot read localStorage. The header toggle writes the
 * preference; the search bar, home page suggestions, and synonym links all
 * carry it forward as `?ageGroup=`. Without one, the default applies.
 *
 * Next.js 14 App Router: params and searchParams are plain objects here, not
 * promises — no await needed (that's a Next 15 change).
 */
export default async function WordPage({
  params,
  searchParams,
}: {
  params: { word: string }
  searchParams: { ageGroup?: string }
}) {
  const { word } = params
  const { ageGroup: requested } = searchParams
  const decoded = decodeURIComponent(word)

  const ageGroup: AgeGroup =
    requested === '7-10' || requested === '4-6' ? requested : config.defaultAgeGroup

  const result = await lookupWord(decoded, ageGroup)

  if (!result.found) {
    return (
      <main className="container mx-auto max-w-2xl px-4 py-12">
        <Card>
          <CardContent className="text-center">
            <h1 className="mb-2 font-fredoka text-3xl font-bold">
              Hmm, we don&apos;t know that word!
            </h1>
            <p className="mb-6 font-nunito text-lg text-muted-foreground">
              Check the spelling and try again, or look up a different word.
            </p>
            <SearchBar />
            <Link href="/" className="mt-6 inline-block font-nunito font-bold text-primary hover:underline">
              ← Back home
            </Link>
          </CardContent>
        </Card>
      </main>
    )
  }

  return (
    <main className="container mx-auto max-w-2xl px-4 py-8">
      <DictionaryEntry data={result.data} />

      {/* The scene text is already known here, so the fallback shows the whole
          story and only the picture itself is still missing. */}
      <Suspense
        fallback={
          <ComicStrip
            word={result.data.word}
            imageUrl={null}
            scenes={result.data.storyScript}
            pending
          />
        }
      >
        <Comic data={result.data} comic={result.comic} />
      </Suspense>

      <div className="mt-8">
        <SearchBar />
      </div>
    </main>
  )
}
