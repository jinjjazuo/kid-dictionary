import Replicate from 'replicate'
import { config } from '@/config'
import { createClient } from '@/lib/supabase/server'
import type { Scene } from '@/types'
import { buildComicImagePrompt } from '@/lib/claude'

const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN })

export async function generateAndStoreComicImage(
  word: string,
  ageGroup: string,
  scenes: Scene[],
  panelCount: number
): Promise<string | null> {
  try {
    const prompt = buildComicImagePrompt(scenes, panelCount)

    const output = await replicate.run(config.ai.imageModel as `${string}/${string}`, {
      input: { prompt, width: 1024, height: 512, num_outputs: 1 },
    })

    // Replicate returns an array of URLs or ReadableStreams
    const imageUrl = Array.isArray(output) ? output[0] : output
    if (!imageUrl) return null

    // Fetch the image and upload to Supabase Storage
    const imageRes = await fetch(imageUrl as string)
    if (!imageRes.ok) return null

    const blob = await imageRes.blob()
    const filename = `${word}-${ageGroup}-${Date.now()}.webp`

    const supabase = await createClient()
    const { data, error } = await supabase.storage
      .from('comic-images')
      .upload(filename, blob, { contentType: 'image/webp', upsert: false })

    if (error || !data) return null

    const { data: { publicUrl } } = supabase.storage
      .from('comic-images')
      .getPublicUrl(data.path)

    return publicUrl
  } catch {
    return null
  }
}
