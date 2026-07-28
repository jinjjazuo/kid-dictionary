import { config } from '@/config'
import { createServiceClient } from '@/lib/supabase/server'
import type { ImageStore } from './types'

const BUCKET = 'comics'

/**
 * Stores comics in a public Supabase Storage bucket.
 *
 * Uploads carry a one-year Cache-Control header. Comics are immutable once
 * generated, so browsers keeping them for a year is correct rather than
 * aggressive — and it is what holds monthly egress inside the free tier,
 * since a repeat view then costs nothing.
 */
export class SupabaseImageStore implements ImageStore {
  async put(key: string, data: Buffer, contentType: string): Promise<string | null> {
    try {
      const supabase = createServiceClient()

      const { error } = await supabase.storage.from(BUCKET).upload(key, data, {
        contentType,
        cacheControl: String(config.images.cacheSeconds),
        // Overwrite rather than fail: a retry after a partial write should
        // succeed, and the key already encodes the content version.
        upsert: true,
      })
      if (error) return null

      const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(key)
      return urlData.publicUrl ?? null
    } catch {
      return null
    }
  }
}
