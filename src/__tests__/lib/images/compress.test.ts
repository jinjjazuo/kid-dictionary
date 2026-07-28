import { describe, it, expect } from 'vitest'
import sharp from 'sharp'
import { compressToWebp, comicObjectKey } from '@/lib/images/compress'

/** A real PNG, so sharp exercises its actual decode path. */
async function makePng(width = 1024, height = 512): Promise<Buffer> {
  return sharp({
    create: {
      width, height, channels: 3,
      background: { r: 255, g: 120, b: 40 },
    },
  }).png().toBuffer()
}

describe('compressToWebp', () => {
  it('produces a WebP', async () => {
    const webp = await compressToWebp(await makePng())
    const meta = await sharp(webp).metadata()
    expect(meta.format).toBe('webp')
  })

  it('produces a smaller file than the source PNG', async () => {
    // The size ratio is what keeps the app inside the Supabase free tier,
    // so it is a requirement rather than an optimisation.
    const png = await makePng()
    const webp = await compressToWebp(png)
    expect(webp.length).toBeLessThan(png.length)
  })

  it('preserves the image dimensions', async () => {
    const webp = await compressToWebp(await makePng(800, 400))
    const meta = await sharp(webp).metadata()
    expect(meta.width).toBe(800)
    expect(meta.height).toBe(400)
  })

  it('rejects input that is not an image', async () => {
    await expect(compressToWebp(Buffer.from('not an image'))).rejects.toThrow()
  })
})

describe('comicObjectKey', () => {
  it('includes the word, age group and image version', () => {
    expect(comicObjectKey('dinosaur', '4-6', 1)).toBe('dinosaur-4-6-v1.webp')
  })

  it('normalises case so one word maps to one object', () => {
    expect(comicObjectKey('Dinosaur', '4-6', 1)).toBe('dinosaur-4-6-v1.webp')
  })

  it('strips characters that are unsafe in an object key', () => {
    // A looked-up word can contain spaces, apostrophes or slashes, all of
    // which break either the key or the public URL.
    expect(comicObjectKey("ice cream", '4-6', 1)).toBe('ice-cream-4-6-v1.webp')
    expect(comicObjectKey("don't", '7-10', 2)).toBe('dont-7-10-v2.webp')
  })

  it('changes when the image version changes', () => {
    // Bumping the version must produce a new object rather than overwriting
    // the old one, since the old row may still be served during rollout.
    expect(comicObjectKey('dinosaur', '4-6', 2)).not.toBe(comicObjectKey('dinosaur', '4-6', 1))
  })
})
