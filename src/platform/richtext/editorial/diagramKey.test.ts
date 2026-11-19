import { describe, expect, it } from 'vitest'

import { toDiagramKeyProps } from './diagramKey'

describe('toDiagramKeyProps', () => {
  it('maps items in order, trimmed', () => {
    expect(
      toDiagramKeyProps({
        items: [
          { label: ' North roundabout ', text: ' Ramps meet the crossing road. ' },
          { label: 'Westbound loop', text: '' },
        ],
      }),
    ).toEqual({
      items: [
        { label: 'North roundabout', text: 'Ramps meet the crossing road.' },
        { label: 'Westbound loop', text: null },
      ],
    })
  })

  it('keeps an empty row in the middle so the numbers still match the image', () => {
    const { items } = toDiagramKeyProps({
      items: [{ label: 'One' }, { label: ' ', text: '' }, { label: 'Three' }],
    })
    expect(items.map((item) => item.label)).toEqual(['One', '', 'Three'])
  })

  it('drops empty rows at the end only', () => {
    const { items } = toDiagramKeyProps({
      items: [{ label: 'One' }, { label: 'Two' }, { label: '', text: ' ' }],
    })
    expect(items).toHaveLength(2)
  })
})
