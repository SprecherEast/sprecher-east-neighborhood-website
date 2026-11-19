// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import type { RichTextValue } from '@/platform/lib'
import { expectAccessible } from '@/platform/ui/testing/expectAccessible'

import type { FaqEntry } from '../domain/types'
import { FaqList } from './FaqList'

afterEach(cleanup)

const answer = (value: string) =>
  ({
    root: {
      type: 'root',
      format: '',
      indent: 0,
      version: 1,
      direction: 'ltr',
      children: [
        {
          type: 'paragraph',
          format: '',
          indent: 0,
          version: 1,
          direction: 'ltr',
          textFormat: 0,
          children: [
            {
              type: 'text',
              text: value,
              format: 0,
              detail: 0,
              mode: 'normal',
              style: '',
              version: 1,
            },
          ],
        },
      ],
    },
  }) as unknown as RichTextValue

const ITEMS: FaqEntry[] = [
  { id: 1, question: 'Who runs this site?', answer: answer('Neighbors, with AI help.') },
  { id: 2, question: 'Is it official?', answer: answer('No, it is unofficial.') },
]

describe('FaqList', () => {
  it('shows each question as a row that opens to its answer, all closed at first', () => {
    const { container } = render(<FaqList items={ITEMS} />)

    const boxes = container.querySelectorAll('details')
    expect(boxes).toHaveLength(2)
    expect([...boxes].every((box) => !box.hasAttribute('open'))).toBe(true)
    expect(screen.getByText('Who runs this site?').closest('summary')).toBeTruthy()
    expect(screen.getByText('No, it is unofficial.').closest('details')).toBe(boxes[1])
  })

  it('has no accessibility violations', async () => {
    const { container } = render(<FaqList items={ITEMS} />)

    await expectAccessible(container)
  })
})
