// Temporary placeholder for Task 4's browser verification step.
// This page is fully rewritten in Task 10 (it previously imported
// AddToDictionaryButton, deleted in this task, and word-pipeline, which
// currently fails to build).
export default function WordPage({ params }: { params: { word: string } }) {
  return (
    <main className="min-h-screen p-6 max-w-2xl mx-auto">
      <p className="font-nunito">Placeholder for &quot;{decodeURIComponent(params.word)}&quot; — rebuilt in Task 10.</p>
    </main>
  )
}
