// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { RichTextValue } from '@/platform/lib'
import { SECTION_SCROLL_MARGIN } from '@/platform/ui/scrollMargin'

import { RichText, type RichTextBlocks } from './RichText'

afterEach(cleanup)

const text = (value: string) => ({
  type: 'text',
  text: value,
  format: 0,
  detail: 0,
  mode: 'normal',
  style: '',
  version: 1,
})

const doc = (...children: Record<string, unknown>[]) =>
  ({
    root: {
      type: 'root',
      format: '',
      indent: 0,
      version: 1,
      direction: 'ltr',
      children,
    },
  }) as unknown as RichTextValue

const paragraph = (...children: Record<string, unknown>[]) => ({
  type: 'paragraph',
  format: '',
  indent: 0,
  version: 1,
  direction: 'ltr',
  textFormat: 0,
  children,
})

const block = (fields: Record<string, unknown>) => ({
  type: 'block',
  format: '',
  version: 2,
  fields: { id: 'b1', blockName: '', ...fields },
})

const internalLink = (relationTo: string, slug: string, label: string) => ({
  type: 'link',
  format: '',
  indent: 0,
  version: 3,
  direction: 'ltr',
  fields: { linkType: 'internal', newTab: false, doc: { relationTo, value: { id: 1, slug } } },
  children: [text(label)],
})

const customLink = (url: string, label: string, newTab = false) => ({
  type: 'link',
  format: '',
  indent: 0,
  version: 3,
  direction: 'ltr',
  fields: { linkType: 'custom', url, newTab },
  children: [text(label)],
})

describe('RichText', () => {
  it('renders the text of the document', () => {
    render(<RichText data={doc(paragraph(text('Welcome, neighbors')))} />)

    expect(screen.getByText('Welcome, neighbors').tagName).toBe('P')
  })

  it('renders a block with the renderer it is given for that block type', () => {
    const blocks: RichTextBlocks = {
      banner: ({ node }) => <aside>Banner: {node.fields.style}</aside>,
    }

    render(<RichText data={doc(block({ blockType: 'banner', style: 'info' }))} blocks={blocks} />)

    expect(screen.getByText('Banner: info')).toBeTruthy()
  })

  it('draws a block it has no renderer for as Payload’s "unknown node"', () => {
    // Why every field that can hold blocks must get renderers (payload.config.test.ts)
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { container } = render(<RichText data={doc(block({ blockType: 'banner' }))} />)

    expect(container.querySelector('aside')).toBeNull()
    expect(container.textContent).toBe('unknown node')
  })

  it('links to a post or a page by its address on the site', () => {
    render(
      <RichText
        data={doc(
          paragraph(
            internalLink('posts', 'park-cleanup', 'the cleanup'),
            text(' and '),
            internalLink('pages', 'about', 'about us'),
          ),
        )}
      />,
    )

    expect(screen.getByRole('link', { name: 'the cleanup' }).getAttribute('href')).toBe(
      '/posts/park-cleanup',
    )
    expect(screen.getByRole('link', { name: 'about us' }).getAttribute('href')).toBe('/about')
  })

  it('draws links with the shared Link, which says when one opens a new tab (#215)', () => {
    render(
      <RichText
        data={doc(
          paragraph(
            customLink('/faq', 'the FAQ'),
            text(' or '),
            customLink('https://www.cityofmadison.com', 'the city', true),
          ),
        )}
      />,
    )

    const faq = screen.getByRole('link', { name: 'the FAQ' })
    expect(faq.className).toContain('text-primary-strong')
    expect(faq.hasAttribute('target')).toBe(false)
    const city = screen.getByRole('link', { name: 'the city, opens in a new tab' })
    expect(city.getAttribute('target')).toBe('_blank')
    expect(city.getAttribute('rel')).toBe('noopener noreferrer')
  })

  it('shows a link to a deleted document as plain text, not a link to the home page', () => {
    const deleted = {
      ...internalLink('posts', 'gone', 'an old post'),
      fields: { linkType: 'internal', newTab: false, doc: { relationTo: 'posts', value: null } },
    }
    render(<RichText data={doc(paragraph(text('See '), deleted))} />)

    expect(screen.queryByRole('link')).toBeNull()
    expect(screen.getByText('See an old post').tagName).toBe('P')
  })

  it('shows a link to a document that was not loaded (only its ID) as plain text', () => {
    const unloaded = {
      ...internalLink('posts', 'x', 'a draft'),
      fields: { linkType: 'internal', newTab: false, doc: { relationTo: 'posts', value: 7 } },
    }
    render(<RichText data={doc(paragraph(unloaded))} />)

    expect(screen.queryByRole('link')).toBeNull()
  })

  it('draws an address typed into the text (an autolink) with the shared Link', () => {
    const autolink = {
      ...customLink('https://example.com', 'example.com'),
      type: 'autolink',
    }
    render(<RichText data={doc(paragraph(autolink))} />)

    const link = screen.getByRole('link', { name: 'example.com' })
    expect(link.getAttribute('href')).toBe('https://example.com')
    expect(link.className).toContain('text-primary-strong')
  })

  it('is a centred prose column by default, and full width without the gutter', () => {
    const { container, rerender } = render(<RichText data={doc(paragraph(text('a')))} />)
    const wrapper = () => container.firstElementChild?.className ?? ''

    expect(wrapper()).toContain('container')
    expect(wrapper()).toContain('prose')

    rerender(<RichText data={doc(paragraph(text('a')))} enableGutter={false} />)
    expect(wrapper()).not.toContain('container')
    expect(wrapper()).toContain('max-w-none')
  })

  it('gives every h2 and h3 a link address with room above it, and leaves other headings alone (#573)', () => {
    const heading = (tag: string, value: string) => ({
      type: 'heading',
      tag,
      version: 1,
      direction: 'ltr',
      format: '',
      indent: 0,
      children: [text(value)],
    })
    render(
      <RichText
        data={doc(
          heading('h2', "What's next?"),
          heading('h2', "What's next?"),
          heading('h4', 'Deep'),
        )}
      />,
    )
    const [first, second] = screen.getAllByRole('heading', { level: 2 })
    expect(first?.id).toBe('whats-next')
    expect(second?.id).toBe('whats-next-2')
    expect(first?.classList.contains(SECTION_SCROLL_MARGIN)).toBe(true)
    expect(screen.getByRole('heading', { level: 4 }).hasAttribute('id')).toBe(false)
  })
})

describe('RichText beside a floated picture (#1023)', () => {
  const rootClasses = (besideFloat?: boolean) => {
    const { container } = render(
      <RichText data={doc(paragraph(text('Body')))} besideFloat={besideFloat} />,
    )
    const classes = (container.firstElementChild as HTMLElement).className
    cleanup()
    return classes
  }

  it('is a box of its own by default, so a floated figure stays inside it', () => {
    expect(rootClasses()).toContain('flow-root')
  })

  it('flows beside a picture before it, and clears it at its end, instead of staying narrow', () => {
    const classes = rootClasses(true)

    expect(classes).not.toContain('flow-root')
    expect(classes).toContain('after:clear-both')
  })
})

describe('RichText as a part of an article (#1023)', () => {
  const heading = (value: string) => ({
    type: 'heading',
    tag: 'h2',
    format: '',
    indent: 0,
    version: 1,
    direction: 'ltr',
    children: [text(value)],
  })

  it('takes its heading ids from the whole article, so they match the menu', () => {
    const first = heading('Costs')
    const second = heading('Costs')
    const whole = doc(first, paragraph(text('One')), second)
    const part = { root: { ...(whole as unknown as { root: object }).root, children: [second] } }

    render(<RichText data={part as unknown as RichTextValue} anchorSource={whole} />)

    expect(screen.getByRole('heading', { level: 2 }).id).toBe('costs-2')
  })
})

describe('RichText, headings (#741)', () => {
  it('balances the lines of its headings, so one never ends on a lone word', () => {
    const { container } = render(<RichText data={doc(paragraph(text('Body')))} />)

    expect((container.firstElementChild as HTMLElement).className).toContain(
      'prose-headings:text-balance',
    )
  })
})
