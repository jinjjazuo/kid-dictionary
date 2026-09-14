import sharp from 'sharp'
import { config } from '@/config'
import type { AgeGroup } from '@/types'

/**
 * Crops a generated comic PNG to its artwork and converts it to WebP.
 *
 * The crop exists because the image model centres the strip on a square
 * canvas; uncropped, the strip renders as a band inside a white box. Only the
 * uniform outer margin goes — the gutters between panels, and the white page
 * of a comic drawn without panel borders, are artwork and stay. An image with
 * no margin comes back uncropped.
 *
 * WebP at the configured quality is roughly an eighth the size of the source
 * PNG with no visible difference on a tablet screen. That ratio is what keeps
 * the app inside Supabase Storage's 1 GB free tier: about 6,600 comics fit
 * instead of about 830. This step is a requirement, not an optimisation.
 *
 * Throws on input that is not a decodable image. The caller treats that as a
 * failed comic and caches the row without one.
 */
export async function compressToWebp(png: Buffer): Promise<Buffer> {
  return sharp(png)
    .trim(config.images.trim)
    .webp({ quality: config.images.quality })
    .toBuffer()
}

/**
 * Builds the storage object key for a comic.
 *
 * The image version is part of the key so bumping it produces a new object
 * rather than overwriting the old one, which may still be served to users
 * holding a cached row during rollout.
 *
 * Words are normalised because a looked-up word can contain spaces,
 * apostrophes or slashes, all of which break either the key or its public URL.
 */
export function comicObjectKey(word: string, ageGroup: AgeGroup, imageVersion: number): string {
  const slug = word
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
  return `${slug}-${ageGroup}-v${imageVersion}.${config.images.format}`
}
