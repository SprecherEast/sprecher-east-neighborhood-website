import { describe, expect, it } from 'vitest'

import { toKeyFactsProps } from './keyFacts'

describe('toKeyFactsProps', () => {
  it('maps stored facts to plain props, with the source resolved', () => {
    expect(
      toKeyFactsProps({
        facts: [
          {
            value: ' 2040s ',
            label: ' earliest construction ',
            detail: ' Not before the state signs off. ',
            icon: 'date',
            certainty: 'estimate',
            linkLabel: 'City budget',
            linkUrl: 'https://example.com/budget',
          },
        ],
      }),
    ).toEqual({
      facts: [
        {
          value: '2040s',
          label: 'earliest construction',
          detail: 'Not before the state signs off.',
          icon: 'date',
          certainty: 'estimate',
          source: {
            href: 'https://example.com/budget',
            label: 'City budget',
            external: true,
            appearance: 'default',
          },
        },
      ],
    })
  })

  it('needs a value and a label, and falls back to cautious defaults', () => {
    const { facts } = toKeyFactsProps({
      facts: [
        { value: '', label: 'total cost', icon: 'money', certainty: 'unknown' },
        { value: '?', label: 'total cost', icon: 'rocket' as never, certainty: 'sure' as never },
      ],
    })
    expect(facts).toEqual([
      {
        value: '?',
        label: 'total cost',
        detail: null,
        icon: 'info',
        certainty: 'unknown',
        source: null,
      },
    ])
  })

  it('treats a blank or missing explanation as none', () => {
    const { facts } = toKeyFactsProps({
      facts: [
        { value: 'A', label: 'a', detail: '   ', icon: 'info', certainty: 'confirmed' },
        { value: 'B', label: 'b', detail: null, icon: 'info', certainty: 'confirmed' },
        { value: 'C', label: 'c', icon: 'info', certainty: 'confirmed' },
      ],
    })
    expect(facts.map((fact) => fact.detail)).toEqual([null, null, null])
  })
})
