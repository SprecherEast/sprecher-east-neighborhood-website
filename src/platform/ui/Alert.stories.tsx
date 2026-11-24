import type { Meta, StoryObj } from '@storybook/nextjs-vite'

import { Alert } from './Alert'

const meta = {
  title: 'Status/Alert',
  component: Alert,
  tags: ['autodocs'],
  args: { tone: 'info', children: 'The next meeting is on the first Tuesday of the month.' },
  argTypes: {
    tone: {
      description: 'The kind of message; its icon says it too, so color is never the only cue',
    },
    title: { description: 'A short heading above the message' },
    live: { description: 'Screen readers announce it when it appears (errors interrupt)' },
  },
} satisfies Meta<typeof Alert>

export default meta
type Story = StoryObj<typeof meta>

export const Playground: Story = {}

export const Success: Story = {
  args: { tone: 'success', children: 'Thanks, your message was sent.' },
}

export const Warning: Story = {
  args: {
    tone: 'warning',
    title: 'Road work',
    children: 'Expect delays on Sprecher Road this week.',
  },
}

export const Error: Story = {
  args: { tone: 'error', children: 'We could not send your message. Please try again.' },
}
