'use client'

import { Badge } from './Badge'
import { defineExample } from './example'

export const Pressable = defineExample({
  purpose: 'Given `onPress` it becomes a button, with a lift on hover and a focus ring',
  render: () => (
    <Badge variant="caution" onPress={() => {}}>
      What this means
    </Badge>
  ),
})
