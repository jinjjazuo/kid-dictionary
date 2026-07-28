/**
 * Colour-coded grammatical category.
 *
 * Colour is reinforcement, never the only signal — the label is always
 * present, so the badge works for a colour-blind child and in greyscale.
 */
const COLOURS: Record<string, string> = {
  noun: 'bg-sky text-sky-foreground',
  verb: 'bg-coral text-coral-foreground',
  adjective: 'bg-lavender text-lavender-foreground',
  adverb: 'bg-mint text-mint-foreground',
  pronoun: 'bg-sunshine text-sunshine-foreground',
}

export function Badge({
  partOfSpeech,
  className = '',
}: {
  partOfSpeech: string | null
  className?: string
}) {
  if (!partOfSpeech) return null
  // Unrecognised categories still render, in neutral. dictionaryapi.dev
  // returns values beyond the five we colour.
  const colour = COLOURS[partOfSpeech] ?? 'bg-muted text-muted-foreground'
  return (
    <span
      className={`inline-flex items-center rounded-md px-2.5 py-1 text-xs font-bold font-nunito ${colour} ${className}`}
    >
      {partOfSpeech}
    </span>
  )
}
