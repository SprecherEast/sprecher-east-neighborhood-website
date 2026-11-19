/** @type {import('tailwindcss').Config} */
const config = {
  theme: {
    extend: {
      typography: () => ({
        DEFAULT: {
          css: [
            {
              // Every prose colour is a theme token, so rich text follows the site's theme
              // (`data-theme`), not the device's dark mode, and no inverted colours are needed
              // (#225, #401). `src/platform/theme/prose.test.ts` checks each one is a token.
              '--tw-prose-body': 'var(--foreground)',
              '--tw-prose-headings': 'var(--foreground)',
              '--tw-prose-lead': 'var(--muted-foreground)',
              '--tw-prose-links': 'var(--primary-strong)',
              '--tw-prose-bold': 'var(--foreground)',
              '--tw-prose-counters': 'var(--muted-foreground)',
              '--tw-prose-bullets': 'var(--muted-foreground)',
              // Decorative lines (WCAG 1.4.11 asks 3:1 only of what's needed to understand)
              '--tw-prose-hr': 'var(--border)',
              '--tw-prose-td-borders': 'var(--border)',
              // The lines that carry meaning: a quote's bar, a table's header rule
              '--tw-prose-quote-borders': 'var(--primary)',
              '--tw-prose-th-borders': 'var(--muted-foreground)',
              '--tw-prose-quotes': 'var(--foreground)',
              '--tw-prose-captions': 'var(--muted-foreground)',
              '--tw-prose-kbd': 'var(--foreground)',
              '--tw-prose-kbd-shadows': 'color-mix(in srgb, var(--foreground) 10%, transparent)',
              '--tw-prose-code': 'var(--foreground)',
              '--tw-prose-pre-code': 'var(--inverse-foreground)',
              '--tw-prose-pre-bg': 'var(--inverse)',
              h1: {
                fontWeight: 'normal',
                marginBottom: '0.25em',
              },
            },
          ],
        },
        base: {
          css: [
            {
              h1: {
                fontSize: '2.5rem',
              },
              h2: {
                fontSize: '1.25rem',
                fontWeight: 600,
              },
            },
          ],
        },
        md: {
          css: [
            {
              h1: {
                fontSize: '3.5rem',
              },
              h2: {
                fontSize: '1.5rem',
              },
            },
          ],
        },
      }),
    },
  },
}

export default config
