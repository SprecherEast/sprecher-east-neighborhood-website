import type { Meta, StoryObj } from '@storybook/nextjs-vite'

import { Tabs } from './Tabs.client'
import { Text } from './Text'

const meta = {
  title: 'Navigation/Tabs',
  component: Tabs,
  tags: ['autodocs'],
  args: {
    label: 'Budget views',
    defaultValue: 'city',
    items: [
      {
        value: 'city',
        trigger: 'City',
        heading: 'City',
        panel: <Text variant="small">The City's share.</Text>,
      },
      {
        value: 'county',
        trigger: 'County',
        heading: 'County',
        panel: <Text variant="small">The County's share.</Text>,
      },
      {
        value: 'school',
        trigger: 'School',
        heading: 'School',
        panel: <Text variant="small">The school district's share.</Text>,
      },
    ],
  },
  argTypes: {
    label: { description: 'Names the tab list for screen readers' },
    defaultValue: { description: 'The tab selected on the first render' },
    headingAs: { description: 'The heading level of each panel heading' },
    items: { control: false, description: 'Two to four tabs fit one row on a phone' },
  },
} satisfies Meta<typeof Tabs>

export default meta
type Story = StoryObj<typeof meta>

export const Playground: Story = {}

export const SecondTabOpen: Story = { args: { defaultValue: 'county' } }
