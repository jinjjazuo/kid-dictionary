import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      fontFamily: {
        fredoka: ['var(--font-fredoka)', 'sans-serif'],
        nunito: ['var(--font-nunito)', 'sans-serif'],
      },
      colors: {
        brand: {
          yellow: '#FDE68A',
          orange: '#FB923C',
          green: '#4ADE80',
          blue: '#60A5FA',
          purple: '#C084FC',
        },
      },
      borderRadius: {
        '4xl': '2rem',
      },
    },
  },
  plugins: [],
}

export default config
