// ============================================================
// tailwind.config.js
// ============================================================
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#b70011',
          container: '#dc2626',
        },
        secondary: {
          DEFAULT: '#0051d5',
          container: '#316bf3',
        },
        tertiary: {
          DEFAULT: '#7a5100',
          container: '#9a6800',
        },
        'nepal-crimson': '#b70011',
        surface: {
          DEFAULT: '#ffffff',
          lowest: '#f7f7f7',
          low: '#ffffff',
          high: '#e8e8e8',
          highest: '#f0f0f0',
          container: '#eaedff',
        },
        // primary "on surface" color (camelCase key used elsewhere)
        onSurface: {
          DEFAULT: '#131b2e',
          variant: '#5c403c',
        },
        // Add a hyphenated alias so legacy/hyphenated classnames continue to work
        'on-surface': {
          DEFAULT: '#131b2e',
          variant: '#5c403c',
        },
        outline: {
          DEFAULT: '#916f6b',
          variant: '#e6bdb8',
        },
        background: '#f8f9fa',
        'on-primary': '#ffffff',
      },
      fontFamily: {
        hanken: ['Hanken Grotesk', 'sans-serif'],
        sans: ['Hanken Grotesk', 'sans-serif'],
      },
      animation: {
        'spin-custom': 'spin 1s linear infinite',
        'pulse-custom': 'pulse 2s ease-in-out infinite',
      },
      keyframes: {
        spin: {
          to: { transform: 'rotate(360deg)' },
        },
        pulse: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(34, 197, 94, 0.4)' },
          '50%': { boxShadow: '0 0 0 5px rgba(34, 197, 94, 0)' },
        },
      },
    },
  },
  plugins: [],
};