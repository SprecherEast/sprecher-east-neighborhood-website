import nextVitals from 'eslint-config-next/core-web-vitals'
import tseslint from 'typescript-eslint'
import unusedImports from 'eslint-plugin-unused-imports'
import eslintConfigPrettier from 'eslint-config-prettier'
import { boundariesConfig } from './eslint.boundaries.config.mjs'
import { themeTokensConfig } from './eslint.theme.config.mjs'
import { uiKitConfig } from './eslint.ui-kit.config.mjs'

export default [
  // ─── 1. Global ignores ───────────────────────────────────────────────────────
  {
    ignores: [
      '.next/**',
      'out/**',
      'build/**',
      'node_modules/**',
      'data/**',
      '_legacy/**',
      '*.config.js',
      '*.config.mjs',
      '*.config.ts',
      'next-env.d.ts',
      'src/app/(payload)/**',
      'scripts/**',
      'src/migrations/**',
      'src/endpoints/seed/**',
      '.eslintcache',
      '.claude/**',
    ],
  },

  // ─── 2. Next.js recommended rules (flat config since Next 16) ────────────────
  ...nextVitals,

  // ─── 3. TypeScript strict rules ──────────────────────────────────────────────
  ...tseslint.configs.strict,

  // ─── 4. Main rules ──────────────────────────────────────────────────────────
  {
    files: ['**/*.{ts,tsx}'],
    plugins: {
      'unused-imports': unusedImports,
    },
    rules: {
      // ── Unused imports (auto-fixable) ─────────────────────────────────────
      'unused-imports/no-unused-imports': 'error',
      'unused-imports/no-unused-vars': [
        'warn',
        { vars: 'all', varsIgnorePattern: '^_', args: 'after-used', argsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-unused-vars': 'off',

      // ── TypeScript strict ─────────────────────────────────────────────────
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'warn',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      // `import { type A }` alone becomes `import type { A }`, so lint and bundlers see no runtime import
      '@typescript-eslint/no-import-type-side-effects': 'error',

      // ── React best practices ──────────────────────────────────────────────
      // New in eslint-plugin-react-hooks 7 (Next 16). Off until the 9 places that break them are
      // fixed (#193); then they come back as errors.
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/refs': 'off',
      'react-hooks/purity': 'off',
      'react/self-closing-comp': 'error',
      'react/jsx-curly-brace-presence': ['error', { props: 'never', children: 'never' }],
      // Disable — modern React handles apostrophes/quotes in JSX fine
      'react/no-unescaped-entities': 'off',

      // ── Max file length ───────────────────────────────────────────────────
      'max-lines': ['error', { max: 250, skipBlankLines: true, skipComments: true }],

      // ── General quality ───────────────────────────────────────────────────
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'prefer-const': 'error',
      'no-var': 'error',
      eqeqeq: ['error', 'always'],
    },
  },

  // ─── 5. Architecture boundaries (errors since #137) ──────────────────────────
  boundariesConfig,

  // ─── 6. Theme tokens only, no raw colours in classes (#146) ──────────────────
  themeTokensConfig,

  // ─── 7. The UI kit's controls, no raw form elements outside it (#465) ────────
  uiKitConfig,

  // ─── 8. Prettier must be last ────────────────────────────────────────────────
  eslintConfigPrettier,
]
