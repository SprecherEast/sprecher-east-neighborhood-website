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

  it('high: holds the description in the shared glass panel, with no glass classes of its own', () => {
    const { container } = inMain(
      <PageHero variant="high" body={body} image={image} links={links} />,
    )
    const panel = screen.getByText('Neighbors on the Far East Side.').closest('.backdrop-blur-xl')
    expect(panel).toBeTruthy()
    expect(panel?.querySelector('.bg-scrim\\/55')).toBeTruthy()
    // The title is not on the glass
    expect(panel?.contains(screen.getByRole('heading', { level: 1 }))).toBe(false)
    expect(container.querySelectorAll('.backdrop-blur-xl')).toHaveLength(1)
  })

  it("high: crops the photo around the upload's focal point, the centre when it has none (#1013)", () => {
    const { container, rerender } = inMain(
      <PageHero
        variant="high"
        body={body}
        image={{ ...image, focalX: 20, focalY: 80 }}
        links={links}
      />,
    )
    expect(container.querySelector('img')?.style.objectPosition).toBe('20% 80%')

    rerender(
      <main>
        <PageHero variant="high" body={body} image={image} links={links} />
      </main>,
    )
    expect(container.querySelector('img')?.style.objectPosition).toBe('50% 50%')
  })

  it("high: is laid out from the photo's horizon, taken from its ratio and focal point (#1304)", () => {
    const { container } = inMain(
      <PageHero variant="high" body={body} image={{ ...image, focalY: 32.6 }} links={links} />,
    )
    const hero = container.querySelector('main > div') as HTMLElement
    expect(hero.className).toContain('hero-geometry')
    expect(hero.style.getPropertyValue('--hero-aspect')).toBe('1.7778')
    expect(hero.style.getPropertyValue('--hero-focal-y')).toBe('0.326')
    // The next section starts a little lower than the hero's edge
    expect(hero.className).toContain('mb-[var(--hero-below-gap)]')
  })

  it('high: puts the title in the sky, then the note and the buttons below the horizon', () => {
    inMain(<PageHero variant="high" body={body} image={image} links={links} />)
    const title = screen.getByRole('heading', { level: 1 })
    const sky = title.closest('[class*="--hero-horizon"]') as HTMLElement
    expect(sky.className).toContain('items-end')
    expect(sky.className).toContain('pb-[var(--hero-sky-gap)]')

    const below = screen
      .getByText('Neighbors on the Far East Side.')
      .closest('.mt-\\[var\\(--hero-horizon-gap\\)\\]')
    expect(below).toBeTruthy()
    // The title comes first, and the buttons are level with the note, not under it, from md
    expect(
      sky.compareDocumentPosition(below as Node) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    expect(below?.className).toContain('md:items-start')
    expect(below?.contains(screen.getByRole('link', { name: 'Upcoming Events' }))).toBe(true)
    expect(below?.contains(title)).toBe(false)
  })

  it('high: keeps the photo at the top, runs it on under the next section and fades it out (#1304)', () => {
    const { container } = inMain(
      <PageHero variant="high" body={body} image={image} links={links} />,
    )
    const layer = container.querySelector('[aria-hidden="true"]') as HTMLElement
    expect(layer.className).toContain('top-0')
    expect(layer.className).toContain('bottom-[calc(var(--hero-fade-overlap)*-1)]')
    expect(layer.className).toContain('overflow-hidden')
    // Nothing in it takes a click: the next section's links sit under the overlap
    expect(layer.className).toContain('pointer-events-none')
    expect(layer.querySelector('.h-\\[var\\(--hero-photo-h\\)\\] img')).toBeTruthy()
    const fade = layer.querySelector('.hero-fade') as HTMLElement
    expect(fade.className).toContain('bottom-0')
    expect(fade.className).toContain('h-[var(--hero-fade-length)]')
    // The darkening behind the text fades with the photo, so no edge shows where the hero ends
    expect(layer.contains(layer.querySelector('.bg-gradient-to-r'))).toBe(true)
    expect(container.querySelectorAll('.hero-fade')).toHaveLength(1)
  })

  it('high: has no horizon without a photo, so the title sits right under the header', () => {
    const { container } = inMain(<PageHero variant="high" body={body} links={links} />)
    const hero = container.querySelector('main > div') as HTMLElement
    expect(hero.style.getPropertyValue('--hero-focal-y')).toBe('0')
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
