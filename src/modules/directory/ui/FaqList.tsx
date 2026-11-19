import React from 'react'

import { RichText } from '@/platform/richtext/RichText'
import { Disclosure } from '@/platform/ui/Disclosure'

import type { FaqEntry } from '../domain/types'

/** FAQ entries as cards that open to show the answer (native `<details>`, no JavaScript). */
export function FaqList({ items }: { items: readonly FaqEntry[] }) {
  return (
    <div className="space-y-4">
      {items.map((faq) => (
        <Disclosure key={faq.id} variant="card" summary={faq.question}>
          <RichText data={faq.answer} enableGutter={false} />
        </Disclosure>
      ))}
    </div>
  )
}
