// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { expectAccessible } from '@/platform/ui/testing/expectAccessible'

import { IssueMarkdown } from './IssueMarkdown'

afterEach(cleanup)

describe('IssueMarkdown', () => {
  it('renders headings, lists, tables and code', async () => {
    const { container } = render(
      <IssueMarkdown>
        {[
          '## Problem',
          '',
          '- one',
          '- two',
          '',
          '| a | b |',
          '| - | - |',
          '| 1 | 2 |',
          '',
          '```',
          'npm test',
          '```',
        ].join('\n')}
      </IssueMarkdown>,
    )

    expect(screen.getByRole('heading', { name: 'Problem' })).toBeTruthy()
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
    expect(screen.getByRole('table')).toBeTruthy()
    expect(container.querySelector('pre')?.textContent).toContain('npm test')
    await expectAccessible(container)
  })

  it('keeps the page’s one h1: an issue heading never becomes an h1', () => {
    render(<IssueMarkdown>{'# Big\n\n## Medium'}</IssueMarkdown>)
    expect(screen.queryByRole('heading', { level: 1 })).toBeNull()
    expect(screen.getByRole('heading', { name: 'Big' })).toBeTruthy()
  })

  it('shows raw HTML as text, never as elements', () => {
    const { container } = render(
      <IssueMarkdown>
        {'<img src=x onerror="alert(1)"> and <b onclick="x()">bold</b>'}
      </IssueMarkdown>,
    )
    expect(container.querySelector('img')).toBeNull()
    expect(container.querySelector('b')).toBeNull()
  })

  it('links web addresses in a new tab and nothing else', () => {
    render(
      <IssueMarkdown>
        [ok](https://example.com/a) [bad](javascript:alert(1)) [mail](mailto:a@b.co)
      </IssueMarkdown>,
    )
    const link = screen.getByRole('link', { name: /ok/ })
    expect(link.getAttribute('href')).toBe('https://example.com/a')
    expect(link.getAttribute('target')).toBe('_blank')
    expect(screen.queryByRole('link', { name: /bad/ })).toBeNull()
    expect(screen.queryByRole('link', { name: /mail/ })).toBeNull()
    expect(screen.getByText(/bad/)).toBeTruthy()
  })

  it('draws no images, and keeps the alt text', () => {
    const { container } = render(
      <IssueMarkdown>![a diagram](https://example.com/x.png)</IssueMarkdown>,
    )
    expect(container.querySelector('img')).toBeNull()
    expect(screen.getByText('a diagram')).toBeTruthy()
  })

  it('shows task list items as done or not done in words, with no form controls', () => {
    const { container } = render(<IssueMarkdown>{'- [x] shipped\n- [ ] waiting'}</IssueMarkdown>)
    expect(container.querySelector('input')).toBeNull()
    expect(screen.getByText('Done:')).toBeTruthy()
    expect(screen.getByText('Not done:')).toBeTruthy()
  })
})
