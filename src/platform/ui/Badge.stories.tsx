import type { Meta, StoryObj } from '@storybook/nextjs-vite'

import { Badge } from './Badge'

const meta = {
  title: 'Status/Badge',
  component: Badge,
  tags: ['autodocs'],
  args: { children: 'Parks' },
  argTypes: {
    variant: { description: 'What the label says: a category, a state, how certain a step is' },
    size: { description: '`xs` shares a row with a label, `md` stands out among small labels' },
    onPress: {
      control: false,
      description: 'Makes the badge a button that does this when pressed',
    },
  },
} satisfies Meta<typeof Badge>

export default meta
type Story = StoryObj<typeof meta>

export const Playground: Story = {}

export const Cancelled: Story = { args: { variant: 'status', children: 'Cancelled' } }

export const Done: Story = { args: { variant: 'done', children: 'Done' } }

export const Pressable: Story = { args: { onPress: () => {}, children: 'What this means' } }
