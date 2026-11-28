import { describe, expect, it } from 'vitest'

import { defaultSettings, defineExample } from './example'

describe('defineExample', () => {
  it('gives its render function the settings it declares, typed by kind', () => {
    const example = defineExample({
      purpose: 'A thing',
      settings: {
        tone: { kind: 'choice', options: ['calm', 'loud'], default: 'calm' },
        shout: { kind: 'boolean', default: false },
        words: { kind: 'text', default: 'Hello' },
      },
      render: ({ tone, shout, words }) => {
        // The types are the test: a wrong kind would not compile (`npx tsc --noEmit`)
        const checked: ['calm' | 'loud', boolean, string] = [tone, shout, words]
        return checked.join(' ')
      },
    })

    expect(example.render(defaultSettings(example.settings))).toBe('calm false Hello')
  })

  it('needs no settings', () => {
    const example = defineExample({ purpose: 'A thing', render: () => 'plain' })

    expect(defaultSettings(example.settings)).toEqual({})
    expect(example.render({})).toBe('plain')
  })
})

describe('defaultSettings', () => {
  it('is each setting at its default', () => {
    expect(
      defaultSettings({
        on: { kind: 'boolean', default: true },
        pick: { kind: 'choice', options: ['a', 'b'], default: 'b' },
      }),
    ).toEqual({ on: true, pick: 'b' })
  })
})
