'use client'

import React, { useState } from 'react'

import { CertaintyBadge } from '@/platform/ui/CertaintyBadge'

/** A badge that is a button (#1417): it counts its presses, so the gallery shows it answers */
export function PressableBadgeDemo() {
  const [presses, setPresses] = useState(0)
  return (
    <div className="flex flex-wrap items-center gap-3">
      <CertaintyBadge certainty="estimate" size="xs" onPress={() => setPresses(presses + 1)} />
      <span className="text-sm text-muted-foreground">{`Pressed ${presses} times`}</span>
    </div>
  )
}
