import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { ArrowRight } from 'lucide-react'

import { Button } from './Button'

const meta = {
  title: 'Actions/Button',
  component: Button,
  tags: ['autodocs'],
  args: { children: 'Join the neighborhood list' },
  argTypes: {
    variant: { description: 'The look: how much the action stands out' },
    size: { description: 'The height and padding; every size is a full tap target on a phone' },
    fullWidth: { description: 'Fills the row; `mobile` only on phones' },
    loading: { description: 'Shows a spinner and ignores clicks, but stays focusable' },
    disabled: { description: 'Not available right now' },
    external: { description: 'With `href`: opens in a new tab and tells screen readers so' },
    iconEnd: { control: false },
    iconStart: { control: false },
  },
} satisfies Meta<typeof Button>

export default meta
type Story = StoryObj<typeof meta>

export const Playground: Story = {}

export const WithIcon: Story = { args: { iconEnd: <ArrowRight aria-hidden="true" /> } }

export const AsLink: Story = { args: { href: '#', children: 'See the calendar' } }

export const Loading: Story = { args: { loading: true, children: 'Sending' } }

export const Disabled: Story = { args: { disabled: true } }
