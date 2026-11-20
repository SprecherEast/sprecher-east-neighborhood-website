// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { expectAccessible } from '@/platform/ui/testing/expectAccessible'

import { FigureBlock, PanelFigureBlock } from './FigureBlock'

afterEach(cleanup)

describe('FigureBlock', () => {
  it('draws the stored block as a figure with its caption and its expand icon', () => {
    render(
      <FigureBlock
        blockType="figure"
        image={{
          id: 1,
          alt: 'Map',
          url: '/api/media/file/map.png',
          width: 640,
          height: 480,
          createdAt: '2026-10-31T00:00:00.000Z',
          updatedAt: '2026-10-31T00:00:00.000Z',
        }}
        title="Concept"
        label="Figure 2-9"
        caption="Short."
        items={[]}
      />,
    )

    expect(screen.getByText('Figure 2-9')).toBeTruthy()
    expect(screen.getByText('Short.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Enlarge: Concept' })).toBeTruthy()
  })

  it('has no accessibility violations', async () => {
    const { container } = render(
      <FigureBlock
        blockType="figure"
        image={{
          id: 1,
          alt: 'Map',
          url: '/api/media/file/map.png',
          width: 640,
          height: 480,
          createdAt: '2026-10-31T00:00:00.000Z',
          updatedAt: '2026-10-31T00:00:00.000Z',
        }}
        title="Concept"
        label="Figure 2-9"
        items={[]}
      />,
    )
    await expectAccessible(container)
  })
})

describe('PanelFigureBlock (#1333)', () => {
  const image = {
    id: 1,
    alt: 'Map',
    url: '/api/media/file/map.png',
    width: 640,
    height: 480,
    createdAt: '2026-10-31T00:00:00.000Z',
    updatedAt: '2026-10-31T00:00:00.000Z',
  }

  it('follows the article’s picture sizes whatever width the block chose', () => {
    const { container } = render(
      <PanelFigureBlock blockType="figure" image={image} title="Concept" size="two-fifths" />,
    )
    const classes = (container.firstElementChild as HTMLElement).className
    expect(classes).toContain('md:w-[var(--picture-width-md)]')
    expect(classes).toContain('lg:w-[var(--picture-width-lg)]')
    expect(classes).not.toContain('md:w-2/5')
  })

  it('offers Enlarge only when the block has a key or a long caption to show', () => {
    const plain = render(<PanelFigureBlock blockType="figure" image={image} title="Concept" />)
    expect(screen.queryByRole('button', { name: 'Enlarge: Concept' })).toBeNull()
    plain.unmount()

    render(
      <PanelFigureBlock
        blockType="figure"
        image={image}
        title="Concept"
        items={[{ label: 'Ramp', text: 'Here.' }]}
      />,
    )
    expect(screen.getByRole('button', { name: 'Enlarge: Concept' })).toBeTruthy()
  })
})
