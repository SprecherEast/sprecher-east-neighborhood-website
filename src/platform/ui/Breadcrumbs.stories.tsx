import type { Meta, StoryObj } from '@storybook/nextjs-vite'

import { Breadcrumbs } from './Breadcrumbs'

const meta = {
  title: 'Navigation/Breadcrumbs',
  component: Breadcrumbs,
  tags: ['autodocs'],
  args: {
    items: [
      { label: 'Home', href: '/' },
      { label: 'Events', href: '/events' },
      { label: 'Spring clean-up at the park' },
    ],
  },
  argTypes: {
    items: { description: 'The trail, first to last; the last one is the page being shown' },
  },
} satisfies Meta<typeof Breadcrumbs>

export default meta
type Story = StoryObj<typeof meta>

export const Playground: Story = {}

/** A crumb too long for the row is cut with an ellipsis, the page's own title first */
export const LongTitle: Story = {
  args: {
    items: [
      { label: 'Home', href: '/' },
      { label: 'News', href: '/news' },
      { label: 'The city council votes on the new bike lane along Sprecher Road this spring' },
    ],
  },
}
