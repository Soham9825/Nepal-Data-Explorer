// ============================================================
// tailwind.config.js
// ============================================================

/**
 * The single colour for small supporting type — footnotes, notes, helper and
 * metadata text — shared by every palette below.
 *
 * The app grew two neutral text palettes (`ink` for the data dashboards and
 * `onSurface` for the rest of the app), and each accumulated its own idea of
 * what a muted grey was. Small type reads as "faint" well before it fails
 * contrast, so that drift is what made captions and notes look disabled. Both
 * palettes now resolve their muted step from this one value, so fixing
 * legibility is a one-line change here instead of a sweep across every call
 * site.
 *
 * Use it as `text-caption`, which is a colour utility only — it deliberately
 * carries no font-size or weight, so darkening small text never silently
 * resizes it. Pair it with whatever size the layout already uses:
 * `text-xs text-caption`, `text-[10px] text-caption`.
 *
 * #374151 keeps the same weight as the ink greys but drops the warm brown cast,
 * which is what read as a disabled tint against the crimson/blue brand. It is
 * neutral, so it sits correctly next to both the warm and cool chrome.
 * Contrast: 10.3:1 on white, 9.6:1 on the #f7f7f7 canvas.
 */
const CAPTION = '#374151';

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
        // Neutral editorial palette used by the data dashboards: calm text,
        // hairline borders and chart accents instead of saturated brand fills.
        // muted is the shared caption colour; faint is one step lighter and is
        // reserved for chrome that is genuinely de-emphasised (axis ticks,
        // disabled states) rather than for text a reader is meant to take in.
        // #374151 is 10.3:1 and #4B5563 is 7.6:1 on white.
        ink: {
          DEFAULT: '#101828',
          muted: CAPTION,
          faint: '#4B5563',
        },
        // Exposed as its own token so small text can be coloured without
        // touching its size: `text-xs text-caption`. Because both muted steps
        // resolve from CAPTION, existing `text-ink-muted` /
        // `text-onSurface-variant` call sites inherit the fix for free.
        caption: CAPTION,
        hairline: {
          DEFAULT: '#E4E7EC',
          strong: '#D0D5DD',
          // The x-axis rule and its tick marks. Two steps darker than `strong`,
          // which left the baseline only one step above the horizontal gridlines
          // and made the axis read as more grid rather than as the axis.
          axis: '#98A2B3',
        },
        canvas: '#F7F8FA',
        accent: {
          nepal: '#C8102E',
          arrivals: '#2563EB',
          revenue: '#0F766E',
          stay: '#B7791F',
        },
        surface: {
          DEFAULT: '#ffffff',
          lowest: '#f7f7f7',
          low: '#ffffff',
          high: '#e8e8e8',
          highest: '#f0f0f0',
          container: '#eaedff',
        },
        // primary "on surface" color (camelCase key used elsewhere).
        // `variant` is the muted step and shares the app-wide caption colour,
        // so small text is identical across the data dashboards and the rest of
        // the app instead of drifting warm on one side and cool on the other.
        onSurface: {
          DEFAULT: '#131b2e',
          variant: CAPTION,
        },
        // Add a hyphenated alias so legacy/hyphenated classnames continue to work
        'on-surface': {
          DEFAULT: '#131b2e',
          variant: CAPTION,
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
