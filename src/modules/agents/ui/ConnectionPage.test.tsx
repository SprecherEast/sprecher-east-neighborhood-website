// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { ConnectionPage } from './ConnectionPage'

afterEach(cleanup)

describe('ConnectionPage', () => {
  it('shows the title, the same line about the AI agent address, and what it holds', () => {
    render(
      <ConnectionPage title="Connect an AI Tool">
        <p>Inside</p>
      </ConnectionPage>,
    )
    expect(screen.getByRole('heading', { name: 'Connect an AI Tool' })).toBeTruthy()
    expect(screen.getByText('Allow this tool to use the AI agent address.')).toBeTruthy()
    expect(screen.getByText('Inside')).toBeTruthy()
  })
})
