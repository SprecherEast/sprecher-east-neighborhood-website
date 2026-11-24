import type { Meta, StoryObj } from '@storybook/nextjs-vite'

import { Field } from './Field.client'

const meta = {
  title: 'Forms/Field',
  component: Field,
  tags: ['autodocs'],
  args: {
    label: 'Your email',
    hint: 'We only use it to reply.',
    width: 'full',
    children: <Field.Input type="email" placeholder="you@example.com" />,
  },
  argTypes: {
    label: { description: 'What the field is for' },
    hideLabel: { description: 'Keeps the label for screen readers only' },
    required: { description: 'Shows a mark after the label, and "required" to screen readers' },
    hint: { description: 'Help shown under the control' },
    error: { description: 'Shown under the control, announced, and marks the control invalid' },
    layout: { description: 'Where the label sits; `bar` puts a button beside the box' },
    width: { description: '`half` shares a row in a form from 640px' },
    children: { control: false },
    action: { control: false },
    aside: { control: false },
  },
} satisfies Meta<typeof Field>

export default meta
type Story = StoryObj<typeof meta>

export const Playground: Story = {}

export const Required: Story = { args: { required: true } }

export const WithError: Story = {
  args: { error: 'Please enter an email address like you@example.com.' },
}

export const TextArea: Story = {
  args: { label: 'Your message', hint: undefined, children: <Field.TextArea rows={4} /> },
}

export const Checkbox: Story = {
  args: {
    label: 'Send me the monthly newsletter',
    hint: undefined,
    children: <Field.Checkbox />,
  },
}
