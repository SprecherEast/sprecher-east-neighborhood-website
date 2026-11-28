import type { Meta, StoryObj } from '@storybook/nextjs-vite'

import { Button } from './Button'
import { Section } from './Section'
import { Text } from './Text'

const meta = {
  title: 'Layout/Section',
  component: Section,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
  args: {
    tone: 'plain',
    spacing: 'md',
    width: 'page',
    children: (
      <>
        <Text variant="overline">Neighborhood news</Text>
        <Text variant="section">What is happening this week</Text>
        <Text variant="lead">A band of the page: its background, its space and its width.</Text>
      </>
    ),
  },
  argTypes: {
    tone: { description: 'The band background; `brand` is the call-to-action band' },
    spacing: { description: 'The space above and below the content' },
    width: {
      description: 'How wide the content runs: the site container, a reading width, a form',
    },
    placement: { description: '`inline` draws only its tone, for a block inside a page section' },
    as: { description: '`div` where it only sets width and spacing' },
    children: { control: false },
  },
} satisfies Meta<typeof Section>

export default meta
type Story = StoryObj<typeof meta>

export const Playground: Story = {}

export const Surface: Story = { args: { tone: 'surface' } }

/** The call-to-action band: its own dark scope, so text and an `inverse` button read on it */
export const Brand: Story = {
  args: {
    tone: 'brand',
    children: (
      <>
        <Text variant="section">Join the neighborhood list</Text>
        <Button variant="inverse" className="mt-4">
          Sign up
        </Button>
      </>
    ),
  },
}

export const Reading: Story = { args: { width: 'prose' } }
