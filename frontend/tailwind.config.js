/**
 * Tailwind config — LinguaLearn Design System
 *
 * html font-size = 16px  →  1rem = 16px
 * Body default   = 15px  (set via globals.css body { font-size: 0.9375rem })
 *
 * Type scale (all computed from 16px root):
 *   text-xs   = 12px   (labels, meta, badges)
 *   text-sm   = 13px   (secondary text, captions)
 *   text-base = 15px   (primary body — matches body default)
 *   text-lg   = 17px   (card titles, list items)
 *   text-xl   = 20px   (section headings)
 *   text-2xl  = 24px   (page headings)
 *   text-3xl  = 30px   (flashcard word)
 *   text-4xl  = 36px   (display)
 */
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

      /* ── Colours (CSS-var backed) ─────────────────────────────── */
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

      /* ── Font sizes ───────────────────────────────────────────── */
      fontSize: {
        'xs':   ['0.75rem',    { lineHeight: '1.4'  }],   /* 12px */
        'sm':   ['0.8125rem',  { lineHeight: '1.45' }],   /* 13px */
        'base': ['0.9375rem',  { lineHeight: '1.55' }],   /* 15px */
        'lg':   ['1.0625rem',  { lineHeight: '1.5'  }],   /* 17px */
        'xl':   ['1.25rem',    { lineHeight: '1.4'  }],   /* 20px */
        '2xl':  ['1.5rem',     { lineHeight: '1.3'  }],   /* 24px */
        '3xl':  ['1.875rem',   { lineHeight: '1.2'  }],   /* 30px */
        '4xl':  ['2.25rem',    { lineHeight: '1.15' }],   /* 36px */
        '5xl':  ['3rem',       { lineHeight: '1.1'  }],   /* 48px */
        '6xl':  ['3.75rem',    { lineHeight: '1'    }],   /* 60px */
      },

      /* ── Border radius ────────────────────────────────────────── */
      borderRadius: {
        'sm':  '8px',
        DEFAULT:'12px',
        'md':  '12px',
        'lg':  '16px',
        'xl':  '20px',
        '2xl': '24px',
        '3xl': '32px',
      },

      /* ── Spacing ──────────────────────────────────────────────── */
      spacing: {
        '4.5': '1.125rem',   /* 18px */
        '13':  '3.25rem',
        '15':  '3.75rem',
        '18':  '4.5rem',
      },

      /* ── Shadows ──────────────────────────────────────────────── */
      boxShadow: {
        'card':    '0 1px 6px rgb(0 0 0 / 0.06)',
        'card-md': '0 4px 16px rgb(0 0 0 / 0.10)',
        'card-lg': '0 8px 28px rgb(0 0 0 / 0.14)',
        'accent':  '0 3px 12px rgb(37 99 235 / 0.28)',
      },

      /* ── Font family ──────────────────────────────────────────── */
      fontFamily: {
        sans: [
          '-apple-system','BlinkMacSystemFont','SF Pro Text',
          'Inter','Segoe UI','Roboto','Helvetica Neue','Arial','sans-serif',
        ],
        mono: ['SF Mono','Fira Code','Consolas','monospace'],
      },

      /* ── Easing ───────────────────────────────────────────────── */
      transitionTimingFunction: {
        'spring': 'cubic-bezier(0.34,1.56,0.64,1)',
        'smooth': 'cubic-bezier(0.16,1,0.3,1)',
      },

      screens: { xs: '375px' },
    },
  },
  plugins: [],
};
