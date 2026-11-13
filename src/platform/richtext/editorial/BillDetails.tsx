import React, { type ReactNode } from 'react'

import type { ResolvedLink } from '@/platform/lib'
import { cn } from '@/platform/lib/cn'
import { Card } from '@/platform/ui/Card'
import { Disclosure } from '@/platform/ui/Disclosure'
import { Link } from '@/platform/ui/Link'
import { Text } from '@/platform/ui/Text'

import type { BillRowTitles } from './billShare'

/**
 * The three rows under the whole bill (#1111, #1118, #1121), in one card split by divider lines: where the City's share goes (`where`: the
 * breakdown chart, drawn for the home and year shown), why the real bill may differ
 * (the notes, then the tab's short text and detail) and the sources, each source once. The first row is open when the tab loads, with scripting off too; the other two are closed. A row with
 * nothing to show is left out, and a note that is not showing still takes its room, hidden from
 * everyone, so an open row never changes height when a year is chosen. Each row is the kit's
 * `Disclosure`, so it opens and closes without scripting and never moves what is above it.
 */
export function BillDetails({
  titles,
  where,
  notes,
  about,
  sources,
}: {
  /** What each row is called, from the block */
  titles: BillRowTitles
  where?: ReactNode
  /** The notes on why a real bill may differ; one that is not `shown` keeps its room */
  notes: readonly { key: string; text: ReactNode; shown: boolean }[]
  /** What follows the notes: the tab's short text and detail */
  about?: ReactNode
  sources: readonly ResolvedLink[]
}) {
  return (
    <Card variant="elevated" padding="none" className="divide-y divide-border">
      {where && (
        <Disclosure variant="row" summary={titles.breakdown} defaultOpen bodyClassName="space-y-6">
          {where}
        </Disclosure>
      )}
      <Disclosure variant="row" summary={titles.differ} bodyClassName="space-y-3">
        <ul className="list-disc space-y-1 pl-5 text-sm text-foreground">
          {notes.map((note) => (
            <li
              key={note.key}
              className={cn(!note.shown && 'invisible')}
              aria-hidden={note.shown ? undefined : true}
            >
              {note.text}
            </li>
          ))}
        </ul>
        {about}
      </Disclosure>
      {sources.length > 0 && (
        <Disclosure variant="row" summary={titles.sources}>
          <ul className="space-y-1">
            {sources.map((source) => (
              <li key={source.href}>
                <Text variant="small" as="span">
                  <Link href={source.href} external={source.external}>
                    {source.label}
                  </Link>
                </Text>
              </li>
            ))}
          </ul>
        </Disclosure>
      )}
    </Card>
  )
}
