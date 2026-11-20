import React from 'react'

/**
 * The one wrapper for the "Log in with a passkey" button, used by the real button and by the room
 * held for it (`PasskeyButtonRoom`), so the two are the same height to the pixel (#1365). A flex
 * column, not a block: a block adds a line box around the button, and a taller icon would make it
 * a pixel taller than the room, so the page would jump when the button shows.
 */
export function PasskeyButtonStack({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col gap-3">{children}</div>
}
