import 'server-only'

import { toForumUrl } from '../domain/forum'
import * as globals from '../data/globals'

/** The forum's address from the footer global, or `null` when none is set or it isn't https. */
export async function getForumUrl(): Promise<string | null> {
  const footer = await globals.getFooter()
  return toForumUrl(footer?.forumUrl)
}
