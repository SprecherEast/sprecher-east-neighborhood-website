// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import type { ImageRef } from '@/platform/lib'
import { expectAccessible } from '@/platform/ui/testing/expectAccessible'

import { PageHero } from './PageHero'
import { doc, heading, paragraph, text } from './testing/richText'

afterEach(cleanup)

const title = (value: string) => ({ ...heading('h2', value), tag: 'h1' })
const body = doc(title('Your Neighborhood'), paragraph(text('Neighbors on the Far East Side.')))
const image = {
  id: 4,
  alt: 'The pond at sunset',
  url: '/api/media/file/pond.jpg',
  width: 1600,
  height: 900,
  mimeType: 'image/jpeg',
  caption: doc(paragraph(text('Photo by a neighbor'))),
} as ImageRef
const links = [
  { href: '/events', label: 'Upcoming Events', external: false, appearance: 'default' as const },
  { href: '/get-involved', label: 'Get Involved', external: false, appearance: 'outline' as const },
]

const inMain = (hero: React.ReactNode) => render(<main>{hero}</main>)

describe('PageHero', () => {
  it('high: one title over the photo, its text, then the main and the second action', async () => {
    const { container } = inMain(
      <PageHero variant="high" body={body} image={image} links={links} />,
    )

    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    expect(screen.getByText('Neighbors on the Far East Side.')).toBeTruthy()
    // The photo is decoration behind the text
    expect(container.querySelector('[aria-hidden="true"] img')).toBeTruthy()
    expect(container.querySelector('[data-theme="dark"]')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Upcoming Events' }).className).toContain(
      'bg-primary-fill',
    )
    expect(screen.getByRole('link', { name: 'Get Involved' }).className).toContain('bg-accent')
    await expectAccessible(container)
  })

  it('high: draws no button list without links', () => {
    inMain(<PageHero variant="high" body={body} links={[]} />)

    expect(screen.queryByRole('list')).toBeNull()
  })

  it('medium: the text and links in the look the editor chose, then the image and caption', async () => {
    const { container } = inMain(
      <PageHero variant="medium" body={body} image={image} links={links} />,
    )

    expect(screen.getByRole('heading', { level: 1, name: 'Your Neighborhood' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Upcoming Events' }).className).toContain(
      'bg-primary-fill',
    )
    expect(screen.getByRole('link', { name: 'Get Involved' }).className).toContain('border')
    expect(screen.getByRole('img', { name: 'The pond at sunset' })).toBeTruthy()
    expect(screen.getByText('Photo by a neighbor')).toBeTruthy()
    await expectAccessible(container)
  })

  it('medium: draws the image caption as the shared small, muted caption (#635)', () => {
    inMain(<PageHero variant="medium" body={body} image={image} links={links} />)

    const caption = screen.getByText('Photo by a neighbor').closest('.prose') as HTMLElement
    expect(caption.className).toContain('prose-sm')
    expect(caption.parentElement?.className).toContain('text-muted-foreground')
  })

  it('medium and low start clear of the site header, with the same space (#202)', () => {
    for (const hero of [
      <PageHero key="medium" variant="medium" body={body} image={image} links={links} />,
      <PageHero key="low" variant="low" body={body} />,
    ]) {
      const { container } = inMain(hero)
      expect(container.querySelector('h1')?.closest('.mt-16')).not.toBeNull()
      cleanup()
    }
  })

  it('low: the title and text only', async () => {
    const { container } = inMain(<PageHero variant="low" body={body} />)

    expect(screen.getByRole('heading', { level: 1, name: 'Your Neighborhood' })).toBeTruthy()
    expect(screen.queryByRole('link')).toBeNull()
    expect(screen.queryByRole('img')).toBeNull()
    await expectAccessible(container)
  })
})
