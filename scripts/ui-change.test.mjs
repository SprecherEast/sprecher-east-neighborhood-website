import { describe, expect, it } from 'vitest'

import { isUiChange, isUiPath, uiChanges } from './ui-change.mjs'

/** A hunk the way GitHub's pull request file list gives it: no file header, just the lines. */
const patch = (...lines) => ['@@ -1,9 +1,9 @@', ...lines].join('\n')
const file = (filename, extra = {}) => ({ filename, status: 'modified', ...extra })

describe('isUiChange (#868): is a browser test of the screens due', () => {
  const CARD = 'src/modules/events/ui/EventCard.tsx'
  const changed = (filename, ...lines) => file(filename, { patch: patch(...lines) })
  const code = (filename) =>
    changed(filename, '-<p className="p-2">a</p>', '+<p className="p-4">a</p>')

  it('counts a class name change in a module ui folder', () => {
    expect(isUiChange([code(CARD)])).toBe(true)
  })

  it('counts a new component, which has no old side', () => {
    const added = file('src/platform/ui/Badge.tsx', {
      status: 'added',
      patch: '@@ -0,0 +1,2 @@\n+export const Badge = () => <span />\n+export default Badge',
    })
    expect(isUiChange([added])).toBe(true)
  })

  it('counts a CSS change, in the theme and in global styles alike', () => {
    for (const name of [
      'src/themes/default/theme.css',
      'src/app/(frontend)/globals.css',
      'tailwind.config.mjs',
      'postcss.config.js',
      'postcss.config.mjs',
    ]) {
      expect(isUiChange([changed(name, '-  --radius: 4px;', '+  --radius: 8px;')])).toBe(true)
    }
  })

  it('counts a page, a layout and a shared kit file', () => {
    for (const name of [
      'src/app/(frontend)/page.tsx',
      'src/app/(frontend)/layout.tsx',
      'src/app/(frontend)/events/page.tsx',
      'src/platform/ui/Button.tsx',
      'src/platform/richtext/RichText.tsx',
      'src/platform/theme/ThemeProvider.client.tsx',
      'src/platform/turnstile/TurnstileWidget.client.tsx',
      'src/app/icon.svg',
      'src/app/apple-icon.png',
    ]) {
      expect(isUiChange([code(name)]), name).toBe(true)
    }
  })

  it('counts a file moved out of a ui folder', () => {
    const moved = file('src/modules/events/domain/EventCard.tsx', {
      status: 'renamed',
      previous_filename: CARD,
      patch: '',
    })
    expect(isUiChange([moved])).toBe(true)
  })

  it('ignores a comment-only edit', () => {
    expect(isUiChange([changed(CARD, '-// old note', '+// new note')])).toBe(false)
    expect(isUiChange([changed('src/themes/default/theme.css', '-/* old */', '+/* new */')])).toBe(
      false,
    )
  })

  it('ignores a whitespace-only edit', () => {
    expect(isUiChange([changed(CARD, '-  const a = 1', '+      const a = 1')])).toBe(false)
    expect(
      isUiChange([
        changed('src/themes/default/theme.css', '-a{color:red}', '+a {', '+  color: red;', '+}'),
      ]),
    ).toBe(false)
  })

  it('ignores a test-only change, whatever folder it sits in', () => {
    expect(isUiChange([code('src/modules/events/ui/EventCard.test.tsx')])).toBe(false)
    expect(isUiChange([code('src/platform/ui/Button.test.tsx')])).toBe(false)
    expect(isUiChange([code('e2e/alignment.spec.ts')])).toBe(false)
    expect(isUiChange([code('src/platform/ui/testing/axe.tsx')])).toBe(false)
    expect(isUiChange([code('src/platform/turnstile/testing/fake.tsx')])).toBe(false)
    expect(isUiChange([code('src/platform/ui/__snapshots__/Button.snap')])).toBe(false)
  })

  it('ignores a docs-only change, also under a ui folder', () => {
    expect(isUiChange([file('docs/ui/component-set.md', { patch: patch('-a', '+b') })])).toBe(false)
    expect(isUiChange([file('src/platform/ui/README.md', { patch: patch('-a', '+b') })])).toBe(
      false,
    )
  })

  it('ignores code that draws nothing: actions, route handlers, domain, data, config', () => {
    for (const name of [
      'src/modules/events/domain/upcoming.ts',
      'src/modules/accounts/actions.ts',
      'src/modules/events/data/events.ts',
      'src/app/(frontend)/api/health/route.ts',
      'src/payload.config.ts',
      'package.json',
      '.github/workflows/ci.yml',
    ]) {
      expect(isUiChange([code(name)]), name).toBe(false)
    }
  })

  it('fires on one real UI file among comment-only and test files', () => {
    const files = [
      changed(CARD, '-// old', '+// new'),
      code('src/modules/news/ui/PostCard.test.tsx'),
      code('src/modules/news/ui/PostCard.tsx'),
    ]
    expect(uiChanges(files).map((f) => f.filename)).toEqual(['src/modules/news/ui/PostCard.tsx'])
  })

  it('fires when there is no diff to read, since it cannot tell', () => {
    expect(isUiChange([file(CARD, { patch: undefined })])).toBe(true)
  })

  it('is false for an empty change list', () => {
    expect(isUiChange([])).toBe(false)
  })

  it('knows a ui path by the path alone', () => {
    expect(isUiPath('src/modules/site/ui/Header.tsx')).toBe(true)
    expect(isUiPath('src/modules/site/cms/pages.ts')).toBe(false)
  })
})
