// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { CONNECTION_DESCRIPTION } from '../domain/oauth/constants'
import { ConnectionPage } from './ConnectionPage'

afterEach(cleanup)

describe('ConnectionPage', () => {
  it('shows the title, the description the pages share, and what it holds', () => {
    render(
      <ConnectionPage title="Connect an AI Tool">
        <p>Inside</p>
      </ConnectionPage>,
    )
    expect(screen.getByRole('heading', { name: 'Connect an AI Tool' })).toBeTruthy()
    expect(screen.getByText(CONNECTION_DESCRIPTION)).toBeTruthy()
    expect(screen.getByText('Inside')).toBeTruthy()
  })
})
