/**
 * Stores generated comic images and returns a publicly readable URL.
 *
 * Exists so the application can move from Supabase Storage to Cloudflare R2 or
 * S3 when the 1 GB free tier is exhausted — roughly 6,600 comics away —
 * without touching the generation pipeline.
 *
 * `put` returns null on failure rather than throwing. A comic is optional; a
 * storage outage must not fail the whole word lookup.
 */
export interface ImageStore {
  put(key: string, data: Buffer, contentType: string): Promise<string | null>
}
