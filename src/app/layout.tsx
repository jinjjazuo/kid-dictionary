import type { Metadata } from 'next'
import { Fredoka, Nunito } from 'next/font/google'
import './globals.css'

const fredoka = Fredoka({
  subsets: ['latin'],
  variable: '--font-fredoka',
})

const nunito = Nunito({
  subsets: ['latin'],
  variable: '--font-nunito',
})

export const metadata: Metadata = {
  title: 'Word World — Kids Dictionary',
  description: 'Look up any word and watch it come to life in a comic story!',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${fredoka.variable} ${nunito.variable} font-nunito bg-yellow-50 min-h-screen`}>
        {children}
      </body>
    </html>
  )
}
