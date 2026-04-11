'use client'
import { useState, useEffect } from 'react'

interface WordEntry { word: string; definition: string }
interface Props { words: WordEntry[] }

interface LayoutResult {
  table: string[][]
  result: Array<{
    answer: string
    clue: string
    orientation: 'across' | 'down'
    position: number
    startx: number
    starty: number
  }>
}

export default function CrosswordGame({ words }: Props) {
  const [layout, setLayout] = useState<LayoutResult | null>(null)
  const [userInput, setUserInput] = useState<Record<string, string>>({})
  const [solved, setSolved] = useState(false)

  useEffect(() => {
    async function generate() {
      try {
        // @ts-expect-error — no type declarations for this package
        const generateLayout = (await import('crossword-layout-generator')).default
        const entries = words.map(w => ({ answer: w.word.toUpperCase(), clue: w.definition }))
        const result = generateLayout(entries)
        setLayout(result)
      } catch {
        // Layout generation can fail with certain word combinations
      }
    }
    generate()
  }, [words])

  function handleInput(row: number, col: number, value: string) {
    const key = `${row}-${col}`
    const newInput = { ...userInput, [key]: value.toUpperCase().slice(-1) }
    setUserInput(newInput)

    if (layout) {
      const allCorrect = layout.table.every((rowArr, r) =>
        rowArr.every((cell, c) => {
          if (!cell || cell === '-') return true
          return (newInput[`${r}-${c}`] ?? '') === cell
        })
      )
      if (allCorrect) setSolved(true)
    }
  }

  if (!layout) {
    return <p className="font-nunito text-gray-400">Generating crossword...</p>
  }

  const across = layout.result?.filter(r => r.orientation === 'across') ?? []
  const down = layout.result?.filter(r => r.orientation === 'down') ?? []

  // Build a map of cell positions to their clue numbers
  const cellNumbers: Record<string, number> = {}
  layout.result?.forEach(entry => {
    const key = `${entry.starty}-${entry.startx}`
    if (!cellNumbers[key]) cellNumbers[key] = entry.position
  })

  return (
    <div className="space-y-8">
      {solved && (
        <div className="bg-green-100 border-2 border-green-300 rounded-3xl p-6 text-center">
          <p className="font-fredoka text-3xl text-green-600">🎉 You solved it!</p>
        </div>
      )}

      {/* Grid */}
      <div className="overflow-auto">
        <table className="border-collapse mx-auto">
          <tbody>
            {layout.table.map((row, r) => (
              <tr key={r}>
                {row.map((cell, c) => {
                  if (!cell || cell === '-') {
                    return <td key={c} className="w-9 h-9 bg-gray-800" />
                  }
                  const cellKey = `${r}-${c}`
                  const num = cellNumbers[cellKey]
                  const inputVal = userInput[cellKey] ?? ''
                  const isCorrect = inputVal === cell

                  return (
                    <td key={c} className="w-9 h-9 border border-gray-300 relative p-0">
                      {num && (
                        <span className="absolute top-0 left-0.5 text-[9px] font-nunito text-gray-500 leading-none pointer-events-none">
                          {num}
                        </span>
                      )}
                      <input
                        maxLength={2}
                        value={inputVal}
                        onChange={e => handleInput(r, c, e.target.value)}
                        className={`w-full h-full text-center font-fredoka text-lg uppercase focus:bg-yellow-100 focus:outline-none bg-white ${
                          inputVal ? (isCorrect ? 'text-green-600' : 'text-red-500') : 'text-gray-800'
                        }`}
                      />
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Clues */}
      <div className="grid md:grid-cols-2 gap-6">
        {[{ label: 'Across', list: across }, { label: 'Down', list: down }].map(({ label, list }) => (
          <div key={label}>
            <h3 className="font-fredoka text-xl text-orange-400 mb-3">{label}</h3>
            <ol className="space-y-2">
              {list.map((clue) => (
                <li key={`${clue.orientation}-${clue.position}`} className="font-nunito text-gray-600 text-sm">
                  <strong>{clue.position}.</strong> {clue.clue}
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>
    </div>
  )
}
