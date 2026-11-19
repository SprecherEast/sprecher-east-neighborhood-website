// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

// The directory module is replaced: only the pages' own words are checked
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND')
  },
}))

vi.mock('@/modules/directory/server', () => ({
  FaqList: () => null,
  ResourceCard: () => null,
  faqJsonLd: () => ({}),
  findFaqEntries: async () => [],
  findResources: async () => [],
}))

import { generateMetadata } from './faq/page'
import ResourceGroupPage, { generateStaticParams } from './resources/[group]/page'

const group = (id: string) => ({ params: Promise.resolve({ group: id }) })

afterEach(cleanup)

describe('directory pages copy', () => {
  it('describes the FAQ as this unofficial site’s, never as an association’s', () => {
    expect(generateMetadata().description).toBe(
      'Common questions about this unofficial Sprecher East site.',
    )
  })

  it('introduces each resources group briefly, in "neighbors" not "residents"', async () => {
    render(await ResourceGroupPage(group('utilities')))

    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Neighborhood utilities')
    expect(screen.getByText('Contacts and services neighbors use.')).toBeTruthy()
  })

  it('links the other four groups, never the one being read', async () => {
    render(await ResourceGroupPage(group('government')))

    const nav = screen.getByRole('navigation', { name: 'More resources' })
    const links = Array.from(nav.querySelectorAll('a'))

    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/resources/utilities',
      '/resources/safety-health',
      '/resources/housing-renting',
      '/resources/community-family',
    ])
  })

  it('answers not found for an address that is not a group', async () => {
    await expect(ResourceGroupPage(group('everything'))).rejects.toThrow('NEXT_NOT_FOUND')
  })

  it('builds one page for each group', () => {
    expect(generateStaticParams()).toEqual([
      { group: 'utilities' },
      { group: 'government' },
      { group: 'safety-health' },
      { group: 'housing-renting' },
      { group: 'community-family' },
    ])
  })
})
