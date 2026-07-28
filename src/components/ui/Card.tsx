import type { HTMLAttributes, ReactNode } from 'react'

type Props = HTMLAttributes<HTMLDivElement> & { children?: ReactNode }

/** A raised surface. The default container for anything a child reads. */
export function Card({ className = '', children, ...props }: Props) {
  return (
    <div
      className={`rounded-2xl border-2 border-border bg-card shadow-card ${className}`}
      {...props}
    >
      {children}
    </div>
  )
}

export function CardContent({ className = '', children, ...props }: Props) {
  return (
    <div className={`p-6 ${className}`} {...props}>
      {children}
    </div>
  )
}
