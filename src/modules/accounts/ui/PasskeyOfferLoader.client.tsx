'use client'

import dynamic from 'next/dynamic'
import React from 'react'

// Loaded in the browser only when this renders, which the page does only while the passkey switch
// is on: the offer and the WebAuthn browser package are code a neighbor doesn't download
// otherwise. Same split as the card's loader (`AddPasskeyLoader.client.tsx`), made in a client
// component because a Server Component can't lazy-load one. No server render: the offer shows
// nothing until the browser says it can make a passkey anyway.
const PasskeyOfferCard = dynamic(
  () => import('./PasskeyOffer.client').then((m) => m.PasskeyOffer),
  {
    ssr: false,
  },
)

/** The offer to add a passkey, loaded on demand (`PasskeyOffer.client.tsx`). */
export function PasskeyOffer({ eligible }: { eligible: boolean }) {
  return <PasskeyOfferCard eligible={eligible} />
}
