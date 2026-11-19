import { describe, expect, it } from 'vitest'

import { toFigureProps } from './figure'

describe('toFigureProps', () => {
  it('maps the stored block to the figure props', () => {
    expect(
      toFigureProps({
        image: 7,
        title: ' Concept ',
        label: 'Figure 2-9',
        caption: 'Short.',
        longCaption: 'Long.',
        size: 'half',
        items: [
          { label: ' One ', text: ' first ' },
          { label: 'Two', text: '' },
        ],
      }),
    ).toEqual({
      resource: 7,
      title: 'Concept',
      label: 'Figure 2-9',
      caption: 'Short.',
      longCaption: 'Long.',
      size: 'half',
      items: [
        { label: 'One', text: 'first' },
        { label: 'Two', text: null },
      ],
    })
  })

  it('drops empty markers at the end of the key, never one in the middle', () => {
    const props = toFigureProps({
      image: 7,
      title: 'Concept',
      items: [{ label: 'One' }, { label: '' }, { label: 'Three' }, { label: ' ', text: ' ' }],
    })
    expect(props.items?.map((item) => item.label)).toEqual(['One', '', 'Three'])
  })

  it('leaves out what is empty, and keeps the default size', () => {
    const props = toFigureProps({ image: 7, title: 'Concept', label: ' ', caption: '', items: [] })
    expect(props.label).toBeUndefined()
    expect(props.caption).toBeUndefined()
    expect(props.longCaption).toBeUndefined()
    expect(props.size).toBeUndefined()
    expect(props.items).toEqual([])
  })
})
