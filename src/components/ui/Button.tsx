import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Variant = 'playful' | 'default' | 'outline' | 'ghost' | 'destructive'
type Size = 'sm' | 'md' | 'lg' | 'icon'

const VARIANTS: Record<Variant, string> = {
  // The hard offset shadow with no blur is the signature look. active:
  // drops the button into the shadow so it feels physically pressed.
  playful:
    'bg-primary text-primary-foreground shadow-playful hover:brightness-105 ' +
    'active:translate-y-1.5 active:shadow-none',
  default: 'bg-primary text-primary-foreground shadow-button hover:brightness-105',
  outline: 'border-2 border-border bg-card text-foreground hover:border-primary hover:bg-primary/5',
  ghost: 'text-foreground hover:bg-muted',
  destructive: 'bg-destructive text-destructive-foreground hover:brightness-105',
}

const SIZES: Record<Size, string> = {
  // Minimum 48px tall on every non-icon size: small fingers on tablets.
  sm: 'h-12 px-4 text-sm gap-1.5',
  md: 'h-12 px-6 text-base gap-2',
  lg: 'h-14 px-8 text-lg gap-2',
  icon: 'h-12 w-12',
}

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant
  size?: Size
  children?: ReactNode
}

/**
 * The application's only button.
 *
 * Sizes enforce a 48px minimum touch target because the audience is children
 * using tablets, where the default 32px control is unreliable to hit.
 */
export function Button({
  variant = 'default',
  size = 'md',
  className = '',
  children,
  ...props
}: Props) {
  return (
    <button
      className={[
        'inline-flex items-center justify-center rounded-lg font-nunito font-bold',
        'transition-all disabled:opacity-50 disabled:pointer-events-none',
        'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/40',
        VARIANTS[variant],
        SIZES[size],
        className,
      ].join(' ')}
      {...props}
    >
      {children}
    </button>
  )
}
