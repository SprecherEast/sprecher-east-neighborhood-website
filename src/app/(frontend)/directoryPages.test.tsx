// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

// The directory module is replaced: only the pages' own words are checked
vi.mock('@/modules/directory/server', () => ({
  FaqList: () => null,
  ResourceCard: () => null,
  faqJsonLd: () => ({}),
  findFaqEntries: async () => [],
  findResources: async () => [],
}))

import { generateMetadata } from './faq/page'
import ResourcesPage from './resources/page'

afterEach(cleanup)

describe('directory pages copy', () => {
  it('describes the FAQ as this unofficial site’s, never as an association’s', () => {
    expect(generateMetadata().description).toBe(
      'Common questions about this unofficial Sprecher East site.',
    )
  })

  it('introduces the resources briefly, in "neighbors" not "residents"', async () => {
    render(await ResourcesPage())

    expect(screen.getByText('Contacts and services neighbors use.')).toBeTruthy()
  })
})
