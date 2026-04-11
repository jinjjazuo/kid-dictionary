import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { lookupWord } from '@/lib/word-pipeline'
import DictionaryEntry from '@/components/DictionaryEntry'
import ComicStorybook from '@/components/ComicStorybook'
import AddToDictionaryButton from '@/components/AddToDictionaryButton'
import SearchBar from '@/components/SearchBar'
import { getAgeGroupConfig, config } from '@/config'
import type { AgeGroup } from '@/types'

export default async function WordPage({ params }: { params: { word: string } }) {
  const word = decodeURIComponent(params.word).toLowerCase().trim()
    .slice(0, config.word.maxInputLength)

  // Determine age group from user profile (guests default to 4-6)
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  let ageGroup: AgeGroup = '4-6'
  if (user) {
    const { data: profile } = await supabase
      .from('profiles').select('age_group').eq('id', user.id).single()
    if (profile?.age_group) ageGroup = profile.age_group as AgeGroup
  }

  const result = await lookupWord(word, ageGroup)
  if (!result.found) notFound()

  const data = result.data
  const { sceneCount } = getAgeGroupConfig(ageGroup)

  return (
    <main className="min-h-screen p-6 max-w-2xl mx-auto space-y-8">
      <SearchBar initialValue={word} />
      <DictionaryEntry data={data} />
      <AddToDictionaryButton wordId={data.id} />
      {data.storyScript.length > 0 && (
        <ComicStorybook
          word={word}
          storyScript={data.storyScript}
          comicImageUrl={data.comicImageUrl}
          panelCount={sceneCount}
        />
      )}
    </main>
  )
}
