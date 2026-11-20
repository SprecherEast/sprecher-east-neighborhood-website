'use client'

import dynamic from 'next/dynamic'
import React from 'react'

// Loaded in the browser only when this renders, which the page does only while the passkey switch
// is on: a card and the WebAuthn browser package are code a neighbor doesn't download otherwise. A
// Server Component can't split a client component off (Next's lazy-loading guide), so the split
// is made here, in a client component. No server render: the card shows nothing until the
// browser says it can make a passkey anyway.
const AddPasskeyCard = dynamic(() => import('./AddPasskey.client').then((m) => m.AddPasskey), {
  ssr: false,
})

/** The add-a-passkey card, loaded on demand (`AddPasskey.client.tsx`). */
export function AddPasskey() {
  return <AddPasskeyCard />
}
