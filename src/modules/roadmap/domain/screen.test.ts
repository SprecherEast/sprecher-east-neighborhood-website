import { describe, expect, it } from 'vitest'

import { HIDDEN_LABELS, isShownPublicly } from './screen'

const issue = (over: Partial<{ labels: string[]; title: string; body: string }> = {}) => ({
  labels: [] as string[],
  title: 'Add a page',
  body: 'Plain words about a page.',
  ...over,
})

describe('isShownPublicly', () => {
  it('shows an ordinary issue', () => {
    expect(isShownPublicly(issue())).toBe(true)
  })

  it.each(HIDDEN_LABELS)('hides an issue labeled %s', (label) => {
    expect(isShownPublicly(issue({ labels: ['bug', label] }))).toBe(false)
  })

  it('hides a server address in the body or the title', () => {
    expect(isShownPublicly(issue({ body: 'ssh to 203.0.113.7 first' }))).toBe(false)
    expect(isShownPublicly(issue({ title: 'Move 198.51.100.20 behind Caddy' }))).toBe(false)
  })

  it('does not take a version number or a date for an address', () => {
    expect(isShownPublicly(issue({ body: 'Upgrade to 1.2.3, due 2026.11.09' }))).toBe(true)
    expect(isShownPublicly(issue({ body: 'Numbers 999.1.1.1 are not addresses' }))).toBe(true)
  })

  it('hides an email address', () => {
    expect(isShownPublicly(issue({ body: 'Ask ada@example.com' }))).toBe(false)
  })

  it('hides plug-and-play plans, however they are spelled', () => {
    expect(isShownPublicly(issue({ body: 'The Plug-and-Play plan' }))).toBe(false)
    expect(isShownPublicly(issue({ body: 'a plug and play plan' }))).toBe(false)
  })
})
