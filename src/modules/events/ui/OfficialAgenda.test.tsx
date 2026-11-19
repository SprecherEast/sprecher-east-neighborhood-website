// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { expectAccessible } from '@/platform/ui/testing/expectAccessible'

import { OfficialAgenda } from './OfficialAgenda'

afterEach(cleanup)

const agendaUrl = 'https://madison.legistar.com/Calendar.aspx'

describe('OfficialAgenda (#122)', () => {
  it('links to the official agenda, in a new tab it announces', async () => {
    const { container } = render(<OfficialAgenda event={{ officialBody: 'city', agendaUrl }} />)

    const link = screen.getByRole('link', { name: /View the official agenda/ })
    expect(link.getAttribute('href')).toBe(agendaUrl)
    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.getAttribute('rel')).toBe('noopener noreferrer')
    expect(link.textContent).toContain('opens in a new tab')
    expect(screen.getByText(/This is a City of Madison meeting/)).toBeDefined()
    await expectAccessible(container)
  })

  it('shows nothing for an official meeting without an agenda link', () => {
    const { container } = render(
      <OfficialAgenda event={{ officialBody: 'county', agendaUrl: null }} />,
    )

    expect(container.innerHTML).toBe('')
  })

  it('shows nothing for an event that is not official', () => {
    const { container } = render(<OfficialAgenda event={{ officialBody: null, agendaUrl }} />)

    expect(container.innerHTML).toBe('')
  })
})
