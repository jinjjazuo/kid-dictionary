import { SupabaseImageStore } from './supabase-image-store'
import type { ImageStore } from './types'

export type { ImageStore } from './types'

/**
 * Returns the active image store.
 *
 * Supabase Storage was chosen over R2 or S3 only because it needs no credit
 * card and no IAM setup, and the 1 GB wall is thousands of comics away.
 * Swapping is a matter of writing another implementation and changing this
 * function.
 */
export function getImageStore(): ImageStore {
  return new SupabaseImageStore()
}
