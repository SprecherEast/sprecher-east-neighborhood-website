import React from 'react'

import { FormBlock } from '@/modules/contact/server'
import { EventsThisWeek, findEventsThisWeek } from '@/modules/events/server'
import {
  findArchivePosts,
  PostGrid,
  toTopIssuesBlockProps,
  TopIssuesBlock,
} from '@/modules/news/server'
import {
  ArchiveBlock,
  CallToActionBlock,
  ContentBlock,
  MapBlock,
  type PageBlockComponents,
} from '@/modules/site/server'
import { MediaBlock } from '@/platform/richtext/MediaBlock'

/** The archive block with the posts it lists: site draws the block, news loads the posts. */
const ArchiveWithPosts: PageBlockComponents['archive'] = async ({ id, intro, postQuery }) => {
  const posts = await findArchivePosts(postQuery)
  return (
    <ArchiveBlock id={id} intro={intro}>
      <PostGrid posts={posts} />
    </ArchiveBlock>
  )
}

/** The "this week" strip (#122): events loads each row's events and maps the block (0013). */
const EventsThisWeekWithEvents: PageBlockComponents['eventsThisWeek'] = async ({
  id,
  heading,
  days,
  rows,
}) => <EventsThisWeek {...await findEventsThisWeek({ id, heading, days, rows })} />

/** "Top issues" (#484): news maps the stored block; with no issue left it draws nothing (0013). */
const TopIssuesFromBlock: PageBlockComponents['topIssues'] = ({
  id,
  heading,
  reviewedAt,
  items,
}) => {
  const props = toTopIssuesBlockProps({ id, heading, reviewedAt, items })
  return props && <TopIssuesBlock {...props} />
}

/**
 * The block registry: which module's component draws each page-builder block type. Modules meet
 * here, not in each other (docs/architecture decision 0008).
 */
export const pageBlocks: PageBlockComponents = {
  archive: ArchiveWithPosts,
  content: ContentBlock,
  cta: CallToActionBlock,
  eventsThisWeek: EventsThisWeekWithEvents,
  // @ts-expect-error The contact form types its form with the form-builder plugin's `Form`, which
  // the generated `Form` doesn't match; the page query populates it, as before #135
  formBlock: FormBlock,
  mapBlock: MapBlock,
  mediaBlock: MediaBlock,
  topIssues: TopIssuesFromBlock,
}
