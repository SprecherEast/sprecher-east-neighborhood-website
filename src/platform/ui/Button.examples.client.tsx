'use client'

import { Button } from './Button'
import { defineExample } from './example'

// Client: a loading Button puts a click guard on its element, and a server page cannot pass a function
export const Loading = defineExample({
  purpose: 'Shows a spinner and ignores presses while work runs, and stays focusable',
  render: () => <Button loading>Sending</Button>,
})
