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
      colors: {
        // Theme-aware colors using CSS custom properties
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
      },
      screens: { xs: '375px' },
    },
  },
  plugins: [],
};
