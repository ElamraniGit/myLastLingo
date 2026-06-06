/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx}',
    './src/components/**/*.{js,ts,jsx,tsx}',
    './src/views/**/*.{js,ts,jsx,tsx}',
    './src/hooks/**/*.{js,ts,jsx,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      /* ── Semantic colour tokens (CSS-var backed) ─────────────── */
      colors: {
        base:     'rgb(var(--bg-base)     / <alpha-value>)',
        surface:  'rgb(var(--bg-surface)  / <alpha-value>)',
        card:     'rgb(var(--bg-card)     / <alpha-value>)',
        elevated: 'rgb(var(--bg-elevated) / <alpha-value>)',
        heading:  'rgb(var(--tx-heading)  / <alpha-value>)',
        body:     'rgb(var(--tx-body)     / <alpha-value>)',
        muted:    'rgb(var(--tx-muted)    / <alpha-value>)',
        faint:    'rgb(var(--tx-faint)    / <alpha-value>)',
        accent:   'rgb(var(--accent)      / <alpha-value>)',
      },

      /* ── Type scale — smaller & precise ─────────────────────── */
      /* html root = 15px, so:  rem × 15 = px                      */
      fontSize: {
        '2xs':  ['0.7rem',    { lineHeight: '1.35' }],   /* ~10.5px */
        'xs':   ['0.75rem',   { lineHeight: '1.4'  }],   /* ~11px   */
        'sm':   ['0.8125rem', { lineHeight: '1.5'  }],   /* ~12px   */
        'base': ['0.9375rem', { lineHeight: '1.55' }],   /* ~14px   */
        'md':   ['1rem',      { lineHeight: '1.5'  }],   /* 15px    */
        'lg':   ['1.0667rem', { lineHeight: '1.45' }],   /* ~16px   */
        'xl':   ['1.2rem',    { lineHeight: '1.38' }],   /* 18px    */
        '2xl':  ['1.467rem',  { lineHeight: '1.28' }],   /* 22px    */
        '3xl':  ['1.8rem',    { lineHeight: '1.2'  }],   /* 27px    */
        '4xl':  ['2.2rem',    { lineHeight: '1.15' }],   /* 33px    */
        '5xl':  ['2.8rem',    { lineHeight: '1.1'  }],   /* 42px    */
      },

      /* ── Border-radius ───────────────────────────────────────── */
      borderRadius: {
        'xs':  '6px',
        'sm':  '9px',
        DEFAULT: '12px',
        'md':  '12px',
        'lg':  '16px',
        'xl':  '20px',
        '2xl': '24px',
        '3xl': '32px',
      },

      /* ── Spacing extras ──────────────────────────────────────── */
      spacing: {
        '4.5': '1.125rem',
        '13':  '3.25rem',
        '15':  '3.75rem',
        '18':  '4.5rem',
      },

      /* ── Shadows ─────────────────────────────────────────────── */
      boxShadow: {
        'card':    '0 1px 8px rgb(0 0 0 / 0.06)',
        'card-md': '0 4px 16px rgb(0 0 0 / 0.10)',
        'card-lg': '0 8px 28px rgb(0 0 0 / 0.14)',
        'accent':  '0 3px 12px rgb(37 99 235 / 0.28)',
        'inner':   'inset 0 1px 3px rgb(0 0 0 / 0.08)',
      },

      /* ── Font family ─────────────────────────────────────────── */
      fontFamily: {
        sans: [
          '-apple-system', 'BlinkMacSystemFont', 'SF Pro Text',
          'Inter', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif',
        ],
        mono: ['SF Mono', 'Fira Code', 'Consolas', 'monospace'],
      },

      /* ── Easing ──────────────────────────────────────────────── */
      transitionTimingFunction: {
        'spring': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
        'smooth': 'cubic-bezier(0.16, 1, 0.3, 1)',
      },

      screens: { xs: '375px' },
    },
  },
  plugins: [],
};
