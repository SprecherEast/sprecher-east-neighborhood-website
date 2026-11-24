import type { Meta, StoryObj } from '@storybook/nextjs-vite'

import { Badge } from './Badge'
import { Button } from './Button'
import { Card, CardBody, CardFooter, CardMeta, CardTitle } from './Card'
import { Text } from './Text'

const meta = {
  title: 'Content/Card',
  component: Card,
  tags: ['autodocs'],
  args: {
    variant: 'elevated',
    padding: 'md',
    interactive: false,
    children: (
      <>
        <CardMeta>
          <Badge>Parks</Badge>
          <span>Saturday, 10 am</span>
        </CardMeta>
        <CardTitle>Spring clean-up at the park</CardTitle>
        <Text variant="small">Bring gloves. Bags and coffee are on us.</Text>
      </>
    ),
  },
  argTypes: {
    variant: { description: 'The box: content card, form box, panel, sidebar box or a toned box' },
    padding: { description: 'The space inside; `none` is for a card with a full-width picture' },
    interactive: { description: 'The card is one link: a deeper shadow and a small lift on hover' },
    as: { description: '`article` for an item in a list, `section` for a panel with a heading' },
    children: { control: false },
  },
} satisfies Meta<typeof Card>

export default meta
type Story = StoryObj<typeof meta>

export const Playground: Story = {}

export const Interactive: Story = {
  args: {
    interactive: true,
    as: 'article',
    children: (
      <>
        <CardMeta>
          <Badge>Meetings</Badge>
        </CardMeta>
        <CardTitle href="#">Neighborhood meeting</CardTitle>
        <Text variant="small">First Tuesday of the month, 7 pm.</Text>
      </>
    ),
  },
}

export const Panel: Story = { args: { variant: 'muted' } }

export const WithFooter: Story = {
  args: {
    padding: 'none',
    children: (
      <CardBody>
        <CardTitle>Neighborhood meeting</CardTitle>
        <Text variant="small">First Tuesday of the month, 7 pm.</Text>
        <CardFooter>
          <Button size="sm">Add to calendar</Button>
        </CardFooter>
      </CardBody>
    ),
  },
}
