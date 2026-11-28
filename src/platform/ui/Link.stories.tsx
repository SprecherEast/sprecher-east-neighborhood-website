import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { ExternalLink } from 'lucide-react'

import { Link } from './Link'

const meta = {
  title: 'Actions/Link',
  component: Link,
  tags: ['autodocs'],
  args: { href: '#', children: 'Read the meeting notes' },
  argTypes: {
    variant: { description: 'Where the link sits: in text, a menu, a footer, a caption' },
    size: { description: 'Only for `nav`: `sm` in the desktop bar, `md` a full row in the menu' },
    current: {
      description: 'This link is the page (`true`) or the section being read (`location`)',
    },
    external: { description: 'Opens in a new tab and tells screen readers so' },
    icon: { control: false },
    iconPosition: { description: 'Whether the icon comes before or after the words' },
    iconOnly: { description: 'Shows only the icon; the words stay for screen readers' },
  },
} satisfies Meta<typeof Link>

export default meta
type Story = StoryObj<typeof meta>

export const Playground: Story = {}

export const Navigation: Story = { args: { variant: 'nav', size: 'sm', children: 'Events' } }

export const CurrentPage: Story = {
  args: { variant: 'nav', size: 'sm', current: true, children: 'News' },
}

export const External: Story = {
  args: { external: true, icon: <ExternalLink aria-hidden="true" />, iconPosition: 'end' },
}
