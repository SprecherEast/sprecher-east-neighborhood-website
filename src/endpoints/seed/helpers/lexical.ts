// Lexical JSON builder helpers — eliminates verbose boilerplate in seed files.
// Each Lexical node typically requires ~15 lines of JSON; these helpers reduce it to 1 call.

// Use [k: string]: unknown to satisfy Payload's richText type constraints
type LexicalNode = { [k: string]: unknown; type: string; version: number }

type Direction = 'ltr' | 'rtl' | null
type Format = '' | 'left' | 'start' | 'center' | 'right' | 'end' | 'justify'

const textNode = (text: string, format: number = 0): LexicalNode => ({
  type: 'text',
  detail: 0,
  format,
  mode: 'normal',
  style: '',
  text,
  version: 1,
})

export const heading = (tag: 'h1' | 'h2' | 'h3' | 'h4', text: string): LexicalNode => ({
  type: 'heading',
  children: [textNode(text)],
  direction: 'ltr' as Direction,
  format: '' as Format,
  indent: 0,
  tag,
  version: 1,
})

export const paragraph = (...children: LexicalNode[]): LexicalNode => ({
  type: 'paragraph',
  children,
  direction: 'ltr' as Direction,
  format: '' as Format,
  indent: 0,
  textFormat: 0,
  version: 1,
})

export const text = (value: string): LexicalNode => textNode(value)

export const boldText = (value: string): LexicalNode => textNode(value, 1)

export const linkNode = (
  label: string,
  url: string,
  options?: { newTab?: boolean },
): LexicalNode => ({
  type: 'link',
  children: [textNode(label)],
  direction: 'ltr' as Direction,
  fields: {
    linkType: 'custom',
    newTab: options?.newTab ?? false,
    url,
  },
  format: '' as Format,
  indent: 0,
  version: 3,
})

export const root = (children: LexicalNode[]) => ({
  root: {
    type: 'root' as const,
    children,
    direction: 'ltr' as Direction,
    format: '' as Format,
    indent: 0,
    version: 1,
  },
})

// Convenience: wrap a single line of text in a paragraph
export const p = (value: string) => paragraph(text(value))

// A block node (a custom block inside rich text) as Lexical stores one; `id` is unique in its post
export const block = (id: string, fields: Record<string, unknown>): LexicalNode => ({
  type: 'block',
  version: 2,
  format: '',
  fields: { id, ...fields },
})
