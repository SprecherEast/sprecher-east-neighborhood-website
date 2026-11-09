// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { expectAccessible } from '@/platform/ui/testing/expectAccessible'

import type { ContentColumn } from '../domain/blocks'
import { ContentBlock } from './ContentBlock'
import { doc, heading, paragraph, text } from './testing/richText'

afterEach(cleanup)

const column = (name: string, size: ContentColumn['size'] = 'oneThird'): ContentColumn => ({
  size,
  body: doc(heading('h3', name), paragraph(text(`About ${name}`))),
})

describe('ContentBlock', () => {
  it('draws one column at a readable width with an accent border', async () => {
    const { container } = render(
      <main>
        <ContentBlock
          layout="single"
          columns={[
            {
              size: 'full',
              body: doc(heading('h2', 'Who we are')),
              link: { href: '/about', label: 'Read more', external: false, appearance: 'outline' },
            },
          ]}
        />
      </main>,
    )

    const text = screen.getByRole('heading', { name: 'Who we are' }).closest('.border-l-4')
    expect(text?.className).toContain('max-w-prose')
    expect(text?.className).toContain('lg:col-span-12')
    // No column gap: it would overflow a narrow section item (a half-width item, say)
    expect(text?.parentElement?.className).not.toMatch(/gap-x-/)
    // The editor's outline look is the secondary button
    expect(screen.getByRole('link', { name: 'Read more' }).className).toContain('border-primary')
    await expectAccessible(container)
  })

  it.each([
    ['single', 'full'],
    ['columns', 'oneThird'],
  ] as const)(
    'puts a link button at the end of its column in the %s layout',
    async (layout, size) => {
      const link = {
        href: '/about',
        label: 'Read more',
        external: false,
        appearance: 'outline' as const,
      }
      const columns =
        layout === 'columns'
          ? [
              column('Our area', 'twoThirds'),
              { ...column('Quick facts', size), link, linkAlign: 'end' as const },
            ]
          : [{ ...column('Our area', size), link, linkAlign: 'end' as const }]
      const { container } = render(
        <main>
          <ContentBlock layout={layout} columns={columns} />
        </main>,
      )

      expect(screen.getByRole('link', { name: 'Read more' }).parentElement?.className).toContain(
        'justify-end',
      )
      await expectAccessible(container)
    },
  )

  it('leaves a link button at the start of its column unless told otherwise', () => {
    const link = {
      href: '/about',
      label: 'Read more',
      external: false,
      appearance: 'outline' as const,
    }
    render(
      <main>
        <ContentBlock layout="single" columns={[{ ...column('Our area', 'full'), link }]} />
      </main>,
    )

    const wrapper = screen.getByRole('link', { name: 'Read more' }).parentElement
    expect(wrapper?.className).not.toContain('justify-end')
    // Either way the button has room above it
    expect(wrapper?.className).toContain('mt-4')
  })

  it('draws text beside a side card', async () => {
    const { container } = render(
      <main>
        <ContentBlock
          layout="columns"
          columns={[column('Our area', 'twoThirds'), column('Quick facts')]}
        />
      </main>,
    )

    const main = screen.getByRole('heading', { name: 'Our area' }).closest('.lg\\:col-span-8')
    expect(main?.className).not.toContain('rounded-2xl')
    const side = screen.getByRole('heading', { name: 'Quick facts' }).closest('.rounded-2xl')
    expect(side?.className).toContain('lg:col-span-4')
    expect(side?.className).toContain('justify-center')
    expect(container.querySelector('section')?.className).not.toContain('bg-surface')
    await expectAccessible(container)
  })

  it('draws cards in a list on a surface band, under their section title', async () => {
    const { container } = render(
      <main>
        <ContentBlock
          layout="cards"
          groups={[
            {
              title: doc(heading('h2', 'Ways to help')),
              cards: [column('Volunteer'), column('Give')],
            },
          ]}
        />
      </main>,
    )

    expect(container.querySelector('section')?.className).toContain('bg-surface')
    const list = screen.getByRole('list')
    expect(within(list).getAllByRole('listitem')).toHaveLength(2)
    expect(list.className).toContain('lg:grid-cols-3')
    // The title is not a card
    expect(within(list).queryByRole('heading', { name: 'Ways to help' })).toBeNull()
    expect(
      screen.getByRole('heading', { name: 'Volunteer' }).closest('.rounded-2xl')?.className,
    ).toContain('shadow-sm')
    await expectAccessible(container)
  })

  it('sets two halves two to a row, and lets a full card take its row', () => {
    render(
      <ContentBlock
        layout="cards"
        groups={[
          { cards: [column('One', 'half'), column('Two', 'half')] },
          { cards: [column('Three', 'full')] },
        ]}
      />,
    )

    const [halves, full] = screen.getAllByRole('list')
    expect(halves.className).toContain('sm:grid-cols-2')
    expect(halves.className).not.toContain('lg:grid-cols-3')
    expect(within(full).getByRole('listitem').className).toContain('col-span-full')
  })

  it('keeps halves two to a row when a full card shares their group', () => {
    render(
      <ContentBlock
        layout="cards"
        groups={[
          { cards: [column('Intro', 'full'), column('One', 'half'), column('Two', 'half')] },
        ]}
      />,
    )

    const list = screen.getByRole('list')
    expect(list.className).toContain('sm:grid-cols-2')
    expect(list.className).not.toContain('lg:grid-cols-3')
    expect(within(list).getAllByRole('listitem')[0].className).toContain('col-span-full')
  })

  it('draws four stats as compact cards in a row of four', async () => {
    const { container } = render(
      <main>
        <ContentBlock
          layout="stats"
          columns={['1', '2', '3', '4'].map((n) => column(`Stat ${n}`))}
        />
      </main>,
    )

    const list = screen.getByRole('list')
    expect(list.className).toContain('lg:grid-cols-4')
    expect(within(list).getAllByRole('listitem')).toHaveLength(4)
    await expectAccessible(container)
  })

  it('draws nothing without columns', () => {
    const { container } = render(<ContentBlock layout="single" columns={[]} />)

    expect(container.innerHTML).toBe('')
  })
})
