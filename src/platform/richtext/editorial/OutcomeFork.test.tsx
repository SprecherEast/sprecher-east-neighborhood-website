// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { expectAccessible } from '@/platform/ui/testing/expectAccessible'

import { OutcomeFork } from './OutcomeFork'

afterEach(cleanup)

describe('OutcomeFork', () => {
  it('shows the question as a heading and each outcome in a list', async () => {
    const { container } = render(
      <OutcomeFork
        question="Will the City and State agree on cost?"
        outcomes={[
          { title: 'If they agree', tone: 'go', description: 'Design, land, contracts.' },
          { title: 'If they don’t', tone: 'stop', description: 'No new interchange.' },
          { title: 'If it stalls', tone: 'open', description: null },
        ]}
      />,
    )

    expect(screen.getByRole('heading').textContent).toBe('Will the City and State agree on cost?')
    const items = within(screen.getByRole('list')).getAllByRole('listitem')
    expect(items.map((item) => item.textContent)).toEqual([
      'Goes ahead: If they agreeDesign, land, contracts.',
      'Doesn’t go ahead: If they don’tNo new interchange.',
      'Other outcome: If it stalls',
    ])
    expect(screen.getByRole('list').className).toContain('sm:grid-cols-3')
    await expectAccessible(container)
  })

  it('draws the question and every outcome with the shared Card, tinted by tone', () => {
    render(
      <OutcomeFork
        question="Will it pass?"
        outcomes={[
          { title: 'Yes', tone: 'go', description: null },
          { title: 'No', tone: 'stop', description: null },
          { title: 'Maybe', tone: 'open', description: null },
        ]}
      />,
    )

    expect(screen.getByRole('heading').parentElement?.className).toContain('bg-surface')
    const [go, stop, open] = within(screen.getByRole('list')).getAllByRole('listitem')
    expect(go?.lastElementChild?.className ?? '').toContain('border-primary/40')
    expect(stop?.lastElementChild?.className ?? '').toContain('border-destructive/30')
    expect(open?.lastElementChild?.className ?? '').toContain('bg-muted')
    for (const item of [go, stop, open]) {
      expect(item?.lastElementChild?.className ?? '').toContain('rounded-2xl')
    }
  })

  it('renders nothing with fewer than two outcomes', () => {
    const { container } = render(
      <OutcomeFork question="Q?" outcomes={[{ title: 'A', tone: 'go', description: null }]} />,
    )
    expect(container.innerHTML).toBe('')
  })
})
