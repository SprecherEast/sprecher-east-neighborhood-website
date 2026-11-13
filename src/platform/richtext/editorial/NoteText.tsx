import React from 'react'

import type { ResolvedLink } from '@/platform/lib'
import { Link } from '@/platform/ui/Link'

/**
 * A note's text with its link drawn where the editor wrote `{link}`. Text that has the blank but
 * no link shows the blank's text as it is, so a half-edited note never hides words; a link with no
 * blank to stand in is not drawn (the editor refuses that on save).
 */
export function NoteText({ text, link }: { text: string; link: ResolvedLink | null }) {
  const [before = '', ...rest] = text.split('{link}')
  if (!link || rest.length === 0) return <>{text}</>
  return (
    <>
      {before}
      <Link href={link.href} external={link.external}>
        {link.label}
      </Link>
      {rest.join('{link}')}
    </>
  )
}
