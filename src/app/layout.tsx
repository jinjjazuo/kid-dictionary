import type { Metadata } from 'next'
import { Fredoka, Nunito } from 'next/font/google'
import { Header } from '@/components/Header'
import './globals.css'

const fredoka = Fredoka({ subsets: ['latin'], variable: '--font-fredoka' })
const nunito = Nunito({ subsets: ['latin'], variable: '--font-nunito' })

export const metadata: Metadata = {
  title: 'Word World — Kids Dictionary',
  description: 'Look up any word and see it come to life in a comic story.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${fredoka.variable} ${nunito.variable} font-nunito flex min-h-screen flex-col`}>
        <Header />
        {children}
      </body>
    </html>
  )
}
