// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { ConnectionCard } from './ConnectionCard'

afterEach(cleanup)

const client = { clientName: 'Claude', redirectHost: 'claude.ai' }

describe('ConnectionCard', () => {
  it('shows who is asking and where it returns to, then what the page puts inside', () => {
    render(
      <ConnectionCard client={client}>
        <p>Inside</p>
      </ConnectionCard>,
    )
    expect(screen.getByText('Claude')).toBeTruthy()
    expect(screen.getByText('claude.ai')).toBeTruthy()
    expect(screen.getByText('Inside')).toBeTruthy()
    expect(screen.queryByText('Acts as')).toBeNull()
  })

  it('names the agent account only when the page gives one', () => {
    render(
      <ConnectionCard client={client} agentName="Scout">
        <p>Inside</p>
      </ConnectionCard>,
    )
    expect(screen.getByText('Acts as')).toBeTruthy()
    expect(screen.getByText('Scout')).toBeTruthy()
  })
})
