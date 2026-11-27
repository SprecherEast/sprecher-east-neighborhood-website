'use client'

import React from 'react'

import { Button, Switch } from '@/platform/ui'

import { GalleryEntry, GalleryVariant } from './GalleryEntry'

/** A switch the page holds the value of, with the state written beside it as a page would */
function Held() {
  const [on, setOn] = React.useState(false)
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <Switch label="Dark mode" checked={on} onCheckedChange={setOn} />
      <span aria-live="polite" className="text-sm text-muted-foreground">
        {on ? 'Dark mode is on' : 'Dark mode is off'}
      </span>
    </div>
  )
}

/** Every state of the on and off switch on its own; `Field.Switch` is shown with the Field controls */
export function SwitchGallery() {
  return (
    <GalleryEntry
      name="Switch"
      description="An on or off switch with its label. A native switch button: Space and Enter turn it, a screen reader hears its state, and the target is 44 px tall."
    >
      <GalleryVariant label="off, on">
        <Switch label="Off" />
        <Switch label="On" defaultChecked />
      </GalleryVariant>
      <GalleryVariant label="disabled, off and on">
        <Switch label="Disabled off" disabled />
        <Switch label="Disabled on" disabled defaultChecked />
      </GalleryVariant>
      <GalleryVariant label="held by the page (checked, onCheckedChange)" className="block">
        <Held />
      </GalleryVariant>
      <GalleryVariant label="hideLabel, in a row with text and a button">
        <div className="flex items-center gap-4">
          <span className="text-sm text-foreground">Appearance</span>
          <Switch label="Dark mode" hideLabel />
          <Button variant="secondary" size="sm">
            Save
          </Button>
        </div>
      </GalleryVariant>
      <GalleryVariant label="long label that wraps" className="block max-w-xs">
        <Switch label="Email me a short note about neighborhood events and meetings" />
      </GalleryVariant>
      <GalleryVariant label="right to left (dir=rtl)" className="block max-w-xs">
        <div dir="rtl">
          <Switch label="وضع داكن" defaultChecked />
        </div>
      </GalleryVariant>
    </GalleryEntry>
  )
}
