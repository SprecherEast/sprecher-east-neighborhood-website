import { describe, expect, it } from 'vitest'

import type { RichTextValue } from '@/platform/lib'

import { RESOURCE_CATEGORIES, type FaqCategory, type ResourceCategory } from './categories'
import { RESOURCE_GROUPS } from './groups'
import { toFaqSections, toResourceGroups, toResourceSections } from './sections'
import type { FaqEntry, ResourceSummary } from './types'

const answer: RichTextValue = {
  root: { type: 'root', children: [], direction: null, format: '', indent: 0, version: 1 },
}

const faq = (id: number, category?: FaqCategory | null): FaqEntry => ({
  id,
  question: `Question ${id}`,
  answer,
  category,
})

const resource = (id: number, category: ResourceCategory): ResourceSummary => ({
  id,
  title: `Resource ${id}`,
  category,
})

const ids = (sections: { items: { id: number }[] }[]) =>
  sections.map(({ items }) => items.map(({ id }) => id))

describe('toFaqSections', () => {
  it('groups entries in category order, labelled, keeping their order within each', () => {
    const sections = toFaqSections([
      faq(1, 'neighborhood'),
      faq(2, 'general'),
      faq(3, 'membership'),
      faq(4, 'general'),
    ])

    expect(sections.map(({ category, label }) => [category, label])).toEqual([
      ['general', 'General'],
      ['membership', 'Membership'],
      ['neighborhood', 'Neighborhood'],
    ])
    expect(ids(sections)).toEqual([[2, 4], [3], [1]])
  })

  it('leaves out categories with no entries', () => {
    expect(toFaqSections([faq(1, 'events')]).map(({ category }) => category)).toEqual(['events'])
  })

  it('files an entry with no category under General', () => {
    const sections = toFaqSections([faq(1, null), faq(2), faq(3, 'membership')])

    expect(sections.map(({ label }) => label)).toEqual(['General', 'Membership'])
    expect(ids(sections)).toEqual([[1, 2], [3]])
  })

  it('files an entry whose category is not on the list under General', () => {
    const stale = { ...faq(1), category: 'retired' as FaqCategory }

    expect(ids(toFaqSections([stale, faq(2, 'general')]))).toEqual([[1, 2]])
  })

  it('returns no sections when there are no entries', () => {
    expect(toFaqSections([])).toEqual([])
  })
})

describe('toResourceSections', () => {
  it('groups resources in category order, labelled, keeping their order within each', () => {
    const sections = toResourceSections([
      resource(1, 'parks'),
      resource(2, 'elected-officials'),
      resource(3, 'parks'),
      resource(4, 'childcare'),
    ])

    expect(sections.map(({ label }) => label)).toEqual([
      'Elected Officials',
      'Childcare & Education',
      'Parks & Recreation',
    ])
    expect(ids(sections)).toEqual([[2], [4], [1, 3]])
  })

  it('files a resource whose category is not on the list under Other', () => {
    // A row saved before an option was removed keeps its old value
    const stale = { ...resource(1, 'other'), category: 'retired' as ResourceCategory }
    const sections = toResourceSections([stale, resource(2, 'other')])

    expect(sections.map(({ category }) => category)).toEqual(['other'])
    expect(ids(sections)).toEqual([[1, 2]])
  })
})

describe('RESOURCE_GROUPS', () => {
  it('puts every resource category in exactly one group', () => {
    const grouped = RESOURCE_GROUPS.flatMap(({ categories }) => categories)

    expect([...grouped].sort()).toEqual(RESOURCE_CATEGORIES.map(({ value }) => value).sort())
  })

  it('gives each group a unique id and a label', () => {
    const groupIds = RESOURCE_GROUPS.map(({ id }) => id)

    expect(new Set(groupIds).size).toBe(groupIds.length)
    expect(RESOURCE_GROUPS.every(({ label }) => label.length > 0)).toBe(true)
  })
})

describe('toResourceGroups', () => {
  it('groups the categories into the four groups, then Other, in that order', () => {
    const groups = toResourceGroups(
      RESOURCE_CATEGORIES.map(({ value }, index) => resource(index, value)),
    )

    expect(groups.map(({ label }) => label)).toEqual([
      'Neighborhood utilities',
      'Government',
      'Safety and health',
      'Housing and neighborhood',
      'Other',
    ])
  })

  it('keeps each category as a section inside its group, in category order', () => {
    const groups = toResourceGroups([
      resource(1, 'community'),
      resource(2, 'renting'),
      resource(3, 'parks'),
      resource(4, 'childcare'),
    ])

    expect(groups).toHaveLength(1)
    expect(groups[0].sections.map(({ category }) => category)).toEqual([
      'childcare',
      'renting',
      'parks',
      'community',
    ])
    expect(ids(groups[0].sections)).toEqual([[4], [2], [3], [1]])
  })

  it('leaves out groups with no resources', () => {
    const groups = toResourceGroups([resource(1, 'public-safety')])

    expect(groups.map(({ label }) => label)).toEqual(['Safety and health'])
  })

  it('files a resource whose category is not on the list under Other', () => {
    const stale = { ...resource(1, 'other'), category: 'retired' as ResourceCategory }
    const groups = toResourceGroups([stale])

    expect(groups.map(({ id }) => id)).toEqual(['other'])
  })

  it('returns no groups when there are no resources', () => {
    expect(toResourceGroups([])).toEqual([])
  })
})
