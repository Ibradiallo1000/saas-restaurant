
import type {Config} from 'tailwindcss';

export default {
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/modules/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        body: ['PT Sans', 'sans-serif'],
        headline: ['Playfair Display', 'serif'],
        code: ['monospace'],
      },
      colors: {
        background: 'rgb(var(--bg-main-rgb) / <alpha-value>)',
        foreground: 'rgb(var(--text-primary-rgb) / <alpha-value>)',
        card: {
          DEFAULT: 'rgb(var(--bg-card-rgb) / <alpha-value>)',
          foreground: 'rgb(var(--text-primary-rgb) / <alpha-value>)',
        },
        popover: {
          DEFAULT: 'rgb(var(--bg-card-rgb) / <alpha-value>)',
          foreground: 'rgb(var(--text-primary-rgb) / <alpha-value>)',
        },
        primary: {
          DEFAULT: 'rgb(var(--primary-rgb) / <alpha-value>)',
          foreground: 'rgb(var(--primary-foreground-rgb) / <alpha-value>)',
        },
        secondary: {
          DEFAULT: 'rgb(var(--bg-secondary-rgb) / <alpha-value>)',
          foreground: 'rgb(var(--text-secondary-rgb) / <alpha-value>)',
        },
        muted: {
          DEFAULT: 'rgb(var(--bg-secondary-rgb) / <alpha-value>)',
          foreground: 'rgb(var(--text-muted-rgb) / <alpha-value>)',
        },
        accent: {
          DEFAULT: 'rgb(var(--border-rgb) / <alpha-value>)',
          foreground: 'rgb(var(--text-primary-rgb) / <alpha-value>)',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        border: 'rgb(var(--border-rgb) / <alpha-value>)',
        input: 'rgb(var(--border-rgb) / <alpha-value>)',
        ring: 'rgb(var(--primary-rgb) / <alpha-value>)',
        chart: {
          '1': 'hsl(var(--chart-1))',
          '2': 'hsl(var(--chart-2))',
          '3': 'hsl(var(--chart-3))',
          '4': 'hsl(var(--chart-4))',
          '5': 'hsl(var(--chart-5))',
        },
        sidebar: {
          DEFAULT: 'rgb(var(--bg-secondary-rgb) / <alpha-value>)',
          foreground: 'rgb(var(--text-secondary-rgb) / <alpha-value>)',
          primary: 'rgb(var(--primary-rgb) / <alpha-value>)',
          'primary-foreground': 'rgb(var(--primary-foreground-rgb) / <alpha-value>)',
          accent: 'rgb(var(--border-rgb) / <alpha-value>)',
          'accent-foreground': 'rgb(var(--text-primary-rgb) / <alpha-value>)',
          border: 'rgb(var(--border-rgb) / <alpha-value>)',
          ring: 'rgb(var(--primary-rgb) / <alpha-value>)',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
} satisfies Config;
