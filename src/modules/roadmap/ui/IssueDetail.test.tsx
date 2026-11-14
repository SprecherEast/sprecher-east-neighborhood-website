// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import React from 'react'
import { afterEach, describe, expect, it } from 'vitest'

import { expectAccessible } from '@/platform/ui/testing/expectAccessible'

import type { PlanEpic, PlanIssue } from '../domain/types'
import { IssueDetail } from './IssueDetail'

afterEach(cleanup)

const issue: PlanIssue = {
  number: 12,
  title: 'A clearer plan page',
  state: 'open',
  labels: ['frontend'],
  description: 'We are making the plan easier to read.',
  url: 'https://github.com/example/site/issues/12',
  closedAt: null,
  createdAt: null,
  updatedAt: null,
}

describe('IssueDetail', () => {
  it('shows the status, labels, text and the link to GitHub', async () => {
    const { container } = render(<IssueDetail issue={issue} />)

    expect(screen.getByText('Open')).toBeTruthy()
    expect(screen.getByText('frontend')).toBeTruthy()
    expect(screen.getByText('We are making the plan easier to read.')).toBeTruthy()
    expect(screen.getByRole('link', { name: /See it on GitHub/ }).getAttribute('href')).toBe(
      issue.url,
    )
    await expectAccessible(container)
  })

  it('says so when there is no description', () => {
    render(<IssueDetail issue={{ ...issue, description: '  ' }} />)
    expect(screen.getByText(/no description for this one yet/)).toBeTruthy()
  })

  it('lists the issues under an epic', () => {
    const epic: PlanEpic = {
      ...issue,
      children: [{ ...issue, number: 13, title: 'A child issue' }],
    }
    render(<IssueDetail issue={epic} />)

    expect(screen.getByText('Issues in this epic')).toBeTruthy()
    expect(screen.getByRole('link', { name: /A child issue/ })).toBeTruthy()
  })
})
