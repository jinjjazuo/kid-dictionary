import type { Config } from 'tailwindcss'

/**
 * Colours are CSS custom properties rather than literals so the whole palette
 * can shift in one place, and so a dark theme can be added later by
 * redefining the variables without touching a single component.
 */
const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    container: { center: true, padding: '1rem' },
    extend: {
      fontFamily: {
        fredoka: ['var(--font-fredoka)', 'sans-serif'],
        nunito: ['var(--font-nunito)', 'sans-serif'],
      },
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: { DEFAULT: 'hsl(var(--primary))', foreground: 'hsl(var(--primary-foreground))' },
        secondary: { DEFAULT: 'hsl(var(--secondary))', foreground: 'hsl(var(--secondary-foreground))' },
        muted: { DEFAULT: 'hsl(var(--muted))', foreground: 'hsl(var(--muted-foreground))' },
        accent: { DEFAULT: 'hsl(var(--accent))', foreground: 'hsl(var(--accent-foreground))' },
        destructive: { DEFAULT: 'hsl(var(--destructive))', foreground: 'hsl(var(--destructive-foreground))' },
        card: { DEFAULT: 'hsl(var(--card))', foreground: 'hsl(var(--card-foreground))' },
        coral: { DEFAULT: 'hsl(var(--coral))', foreground: 'hsl(var(--coral-foreground))' },
        sunshine: { DEFAULT: 'hsl(var(--sunshine))', foreground: 'hsl(var(--sunshine-foreground))' },
        lavender: { DEFAULT: 'hsl(var(--lavender))', foreground: 'hsl(var(--lavender-foreground))' },
        mint: { DEFAULT: 'hsl(var(--mint))', foreground: 'hsl(var(--mint-foreground))' },
        sky: { DEFAULT: 'hsl(var(--sky))', foreground: 'hsl(var(--sky-foreground))' },
      },
      borderRadius: {
        sm: 'calc(var(--radius) - 4px)',
        md: 'calc(var(--radius) - 2px)',
        lg: 'var(--radius)',
        xl: 'calc(var(--radius) + 4px)',
        '2xl': 'calc(var(--radius) + 8px)',
        '3xl': 'calc(var(--radius) + 16px)',
      },
    },
  },
  plugins: [],
}

export default config
