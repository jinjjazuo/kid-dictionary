import Link from 'next/link'
import { Badge } from '@/components/ui/Badge'
import { PlayWord } from '@/components/PlayWord'
import { Card, CardContent } from '@/components/ui/Card'
import type { WordData } from '@/types'

/**
 * The written half of a word page: the word, how it sounds, what it means,
 * examples and synonyms.
 *
 * Rendered above the comic so the definition is never gated on image loading.
 * A child who came to find out what a word means gets that first.
 */
export function DictionaryEntry({ data }: { data: WordData }) {
  return (
    <Card>
      <CardContent>
        <div className="mb-2 flex flex-wrap items-center gap-3">
          <h1 className="font-fredoka text-4xl font-bold capitalize md:text-5xl">{data.word}</h1>
          <Badge partOfSpeech={data.partOfSpeech} />
        </div>

        {/* The recording sits with the phonetics because it is the same
            information, in the form a child who cannot read IPA can use. */}
        {(data.phonetic || data.audioUrl) && (
          <div className="mb-4 flex items-center gap-3">
            <PlayWord word={data.word} audioUrl={data.audioUrl} />
            {data.phonetic && (
              <p className="font-nunito text-lg text-muted-foreground">{data.phonetic}</p>
            )}
          </div>
        )}

        <p className="font-nunito text-xl leading-relaxed">{data.definition}</p>

        {data.examples.length > 0 && (
          <div className="mt-6">
            <h2 className="mb-2 font-fredoka text-xl font-bold">Examples</h2>
            <ul className="space-y-2">
              {data.examples.map((example, i) => (
                <li
                  key={i}
                  className="rounded-lg border-l-4 border-sunshine bg-sunshine/10 px-4 py-2
                             font-nunito text-lg"
                >
                  {example}
                </li>
              ))}
            </ul>
          </div>
        )}

        {data.synonyms.length > 0 && (
          <div className="mt-6">
            <h2 className="mb-2 font-fredoka text-xl font-bold">Words that mean the same</h2>
            <div className="flex flex-wrap gap-2">
              {/* Each synonym is a link, so one lookup leads to the next. */}
              {data.synonyms.map(synonym => (
                <Link
                  key={synonym}
                  href={`/search/${encodeURIComponent(synonym)}?ageGroup=${data.ageGroup}`}
                  className="rounded-full border-2 border-border bg-card px-4 py-2 font-nunito
                             font-bold transition-all hover:border-primary hover:bg-primary/5"
                >
                  {synonym}
                </Link>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
