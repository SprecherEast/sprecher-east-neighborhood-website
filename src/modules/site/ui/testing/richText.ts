import type { RichTextValue } from '@/platform/lib'

/* Small Lexical documents for the block components' tests. */

type Node = Record<string, unknown>

const element = (type: string, extra: Node, children: Node[]) => ({
  type,
  format: '',
  indent: 0,
  version: 1,
  direction: 'ltr',
  ...extra,
  children,
})

export const text = (value: string): Node => ({
  type: 'text',
  text: value,
  format: 0,
  detail: 0,
  mode: 'normal',
  style: '',
  version: 1,
})

export const heading = (tag: 'h2' | 'h3', value: string): Node =>
  element('heading', { tag }, [text(value)])

export const paragraph = (...children: Node[]): Node =>
  element('paragraph', { textFormat: 0 }, children)

export const link = (url: string, value: string): Node =>
  element('link', { fields: { linkType: 'custom', url, newTab: false } }, [text(value)])

export const doc = (...children: Node[]) =>
  ({ root: element('root', {}, children) }) as unknown as RichTextValue
