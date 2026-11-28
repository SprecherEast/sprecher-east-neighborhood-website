import { defineExample } from './example'
import { Tabs, type TabsItem } from './Tabs.client'
import { Text } from './Text'

/*
 * Each example names its own tab links (`anchor`): the examples share one showcase page, and every
 * tab on a page has a link of its own.
 */
const VIEWS = [
  { value: 'city', label: 'City', words: "The City's share." },
  { value: 'county', label: 'County', words: "The County's share." },
  { value: 'school', label: 'School', words: "The school district's share." },
]

/** The tabs of the budget views, for one example: its own link names, the same words. */
const budgetTabs = (prefix: string): TabsItem[] =>
  VIEWS.map(({ value, label, words }) => ({
    value,
    anchor: `${prefix}-${value}`,
    trigger: label,
    heading: label,
    panel: <Text variant="small">{words}</Text>,
  }))

export const Default = defineExample({
  purpose: 'Equal tabs above one panel; the first tab is open when the page loads',
  render: () => <Tabs label="Budget views" defaultValue="city" items={budgetTabs('default')} />,
})

export const SecondTabOpen = defineExample({
  purpose: 'Another tab open on the first render, on the server too, so nothing moves on load',
  render: () => (
    <Tabs label="Budget views, county first" defaultValue="county" items={budgetTabs('second')} />
  ),
})

export const Generated = defineExample({
  purpose: 'Tabs made from a list of data, one for each item, with a link of its own',
  settings: {
    count: {
      kind: 'choice',
      options: ['2', '3', '4'],
      default: '3',
      description: 'Two to four tabs fit one row on a phone',
    },
  },
  render: ({ count }) => {
    const items = Array.from({ length: Number(count) }, (_, index) => ({
      value: `year-${index + 1}`,
      anchor: `generated-year-${index + 1}`,
      trigger: `Year ${index + 1}`,
      heading: `Year ${index + 1}`,
      panel: <Text variant="small">What happened in year {index + 1}.</Text>,
    }))
    return <Tabs label="Years" defaultValue="year-1" items={items} />
  },
})
