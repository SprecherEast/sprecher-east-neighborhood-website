import React from 'react'

import type { ResolvedLink } from '@/platform/lib'
import { Link } from '@/platform/ui/Link'

/**
 * A note's text with its link drawn where the editor wrote `{link}`. A blank with no link to draw
 * (a draft Admin did not check) is left out, so readers never see it; a link with no blank to stand
 * in is not drawn, and a second blank draws nothing (Admin refuses both on save).
 */
export function NoteText({ text, link }: { text: string; link: ResolvedLink | null }) {
  const [before = '', ...rest] = text.split('{link}')
  if (!link || rest.length === 0) return <>{text.split('{link}').join('')}</>
  return (
    <>
      {before}
      <Link href={link.href} external={link.external}>
        {link.label}
      </Link>
      {rest.join('')}
    </>
  )
}
