import type { Meta, StoryObj } from '@storybook/nextjs-vite'

import { Text } from './Text'

const meta = {
  title: 'Content/Text',
  component: Text,
  tags: ['autodocs'],
  args: { variant: 'section', children: 'What is happening this week' },
  argTypes: {
    variant: {
      description: 'The text style: a heading, an eyebrow, a lead paragraph, small print',
    },
    as: { description: 'The element; headings default to `h2`, everything else to `p`' },
    clamp: { description: 'Cuts the text after this many lines' },
  },
} satisfies Meta<typeof Text>

export default meta
type Story = StoryObj<typeof meta>

export const Playground: Story = {}

export const Lead: Story = {
  args: {
    variant: 'lead',
    children: 'Your neighbors, your events, and what the city is deciding, in one place.',
  },
}

export const Clamped: Story = {
  args: {
    variant: 'lead',
    clamp: 2,
    children:
      'A long paragraph is cut after two lines so a card stays the same height as its neighbors. '.repeat(
        4,
      ),
  },
}
