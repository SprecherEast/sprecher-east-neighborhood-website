import React, { type ReactNode } from 'react'

import type { ResolvedLink } from '@/platform/lib'
import { cn } from '@/platform/lib/cn'
import { Card } from '@/platform/ui/Card'
import { Disclosure } from '@/platform/ui/Disclosure'
import { Link } from '@/platform/ui/Link'
import { Text } from '@/platform/ui/Text'

import type { BillRowTitles } from './billShare'

/**
 * The two rows under the whole bill (#1111, #1118, #1163), in one card split by divider lines: why
 * the real bill may differ (the notes, then the tab's short text and detail) and the sources, each source
 * once, both closed when the tab loads, each titled from the block (#1158). Where the City's share goes is a row of the whole bill
 * itself, under the City's row (`BillShare`, #1163). The sources row is left out when there are none,
 * and a note that is not showing still takes its room, hidden from everyone, so an open row never
 * changes height when a year is chosen. Each row is the kit's `Disclosure`, so it opens and closes
 * without scripting and never moves what is above it.
 */
export function BillDetails({
  titles,
  notes,
  about,
  sources,
}: {
  /** What each row is called, from the block */
  titles: BillRowTitles
  /** The notes on why a real bill may differ; one that is not `shown` keeps its room */
  notes: readonly { key: string; text: ReactNode; shown: boolean }[]
  /** What follows the notes: the tab's short text and detail */
  about?: ReactNode
  sources: readonly ResolvedLink[]
}) {
  return (
    <Card variant="elevated" padding="none" className="divide-y divide-border">
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
