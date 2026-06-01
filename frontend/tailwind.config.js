/**
 * FIX BUG-13: Corrected CSS variable syntax for Tailwind v3 opacity modifiers.
 *
 * PROBLEM:
 *   'rgb(var(--bg-primary) / )' — the <alpha-value> placeholder must NOT
 *   be wrapped in rgb() by Tailwind config. Tailwind v3 expects the format:
 *   'rgb(var(--bg-primary) / <alpha-value>)' — but ONLY when the CSS variable
 *   contains space-separated R G B values (which this project does correctly).
 *
 * The original code had 'rgb(var(--bg-primary) / )' with an HTML entity
 * instead of the literal '<alpha-value>' string. This caused opacity modifiers
 * like bg-base/50 to silently fail.
 *
 * @type {import('tailwindcss').Config}
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
        // FIX BUG-13: Correct Tailwind v3 CSS variable + opacity modifier syntax.
        // The <alpha-value> token is replaced by Tailwind when using /opacity modifiers.
        // e.g.  bg-base/50  →  background: rgb(var(--bg-primary) / 0.5)
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
      screens: { xs: '375px' },
    },
  },
  plugins: [],
};
