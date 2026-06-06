/**
 * Tailwind config — LinguaLearn Design System
 * Typography scale bumped: xs=13px, sm=15px, base=17px for better readability.
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
      colors: {
        base:      'rgb(var(--bg-primary) / <alpha-value>)',
        surface:   'rgb(var(--bg-secondary) / <alpha-value>)',
        card:      'rgb(var(--bg-card) / <alpha-value>)',
        elevated:  'rgb(var(--bg-elevated) / <alpha-value>)',
        'input-bg':'rgb(var(--bg-input) / <alpha-value>)',
        heading:   'rgb(var(--text-primary) / <alpha-value>)',
        body:      'rgb(var(--text-secondary) / <alpha-value>)',
        muted:     'rgb(var(--text-muted) / <alpha-value>)',
        faint:     'rgb(var(--text-faint) / <alpha-value>)',
        line:      'rgb(var(--border) / <alpha-value>)',
        'line-s':  'rgb(var(--border-subtle) / <alpha-value>)',
        accent:    'rgb(var(--accent) / <alpha-value>)',
      },
      fontSize: {
        /* Bumped scale for comfortable mobile reading */
        'xs':   ['0.8125rem', { lineHeight: '1.4' }],   /* 13px */
        'sm':   ['0.9375rem', { lineHeight: '1.5' }],   /* 15px */
        'base': ['1.0625rem', { lineHeight: '1.6' }],   /* 17px */
        'lg':   ['1.1875rem', { lineHeight: '1.55' }],  /* 19px */
        'xl':   ['1.375rem',  { lineHeight: '1.4' }],   /* 22px */
        '2xl':  ['1.625rem',  { lineHeight: '1.3' }],   /* 26px */
        '3xl':  ['2rem',      { lineHeight: '1.2' }],   /* 32px */
        '4xl':  ['2.5rem',    { lineHeight: '1.15' }],  /* 40px */
        '5xl':  ['3rem',      { lineHeight: '1.1' }],   /* 48px */
        '6xl':  ['3.75rem',   { lineHeight: '1' }],     /* 60px */
      },
      borderRadius: {
        'sm':  '10px',
        'md':  '14px',
        'lg':  '18px',
        'xl':  '22px',
        '2xl': '28px',
        '3xl': '36px',
      },
      spacing: {
        '4.5': '1.125rem',
        '5.5': '1.375rem',
        '13':  '3.25rem',
        '15':  '3.75rem',
        '18':  '4.5rem',
      },
      screens: { xs: '375px' },
      fontFamily: {
        sans: [
          '-apple-system', 'BlinkMacSystemFont', 'SF Pro Text',
          'Inter', 'Segoe UI Variable', 'Segoe UI', 'Roboto',
          'Helvetica Neue', 'Arial', 'sans-serif',
        ],
      },
      boxShadow: {
        'card':    '0 2px 12px rgb(0 0 0 / 0.06)',
        'card-md': '0 4px 20px rgb(0 0 0 / 0.10)',
        'card-lg': '0 8px 32px rgb(0 0 0 / 0.14)',
        'accent':  '0 4px 16px rgb(37 99 235 / 0.30)',
        'inner':   'inset 0 1px 3px rgb(0 0 0 / 0.08)',
      },
      transitionTimingFunction: {
        'spring': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
        'smooth': 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
    },
  },
  plugins: [],
};
