import { config } from '@/config'
import type { SavedWord, WordStore } from './types'

/**
 * Stores the user's collection in browser localStorage.
 *
 * The whole collection lives under one key as a single JSON array. That keeps
 * reads and writes to one operation each, at the cost of rewriting the array
 * on every change — acceptable at roughly 1 KB per word and a realistic
 * ceiling of a few hundred words.
 *
 * Only usable in the browser. localStorage does not exist during server
 * rendering, so every consumer must be a client component.
 */
export class LocalWordStore implements WordStore {
  private read(): SavedWord[] {
    const raw = localStorage.getItem(config.storage.wordsKey)
    if (!raw) return []
    try {
      const parsed = JSON.parse(raw)
      // A non-array payload means something else wrote to our key. Treating
      // it as empty is better than throwing on every render.
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }

  private write(words: SavedWord[]): void {
    try {
      localStorage.setItem(config.storage.wordsKey, JSON.stringify(words))
    } catch {
      // QuotaExceededError, or storage disabled entirely in private browsing.
      // Unreachable at realistic collection sizes, but a thrown error here
      // would crash the page mid-render for a child.
    }
  }

  async list(): Promise<SavedWord[]> {
    return this.read()
  }

  async add(word: SavedWord): Promise<void> {
    const key = word.word.toLowerCase()
    const existing = this.read().filter(w => w.word.toLowerCase() !== key)
    this.write([{ ...word, word: key }, ...existing])
  }

  async remove(word: string): Promise<void> {
    const key = word.toLowerCase()
    this.write(this.read().filter(w => w.word.toLowerCase() !== key))
  }

  async has(word: string): Promise<boolean> {
    const key = word.toLowerCase()
    return this.read().some(w => w.word.toLowerCase() === key)
  }

  async clear(): Promise<void> {
    localStorage.removeItem(config.storage.wordsKey)
  }
}
