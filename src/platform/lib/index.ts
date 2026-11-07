// Pure helpers and shared content types, with no framework (docs/architecture/README.md).
// A module's domain may import these and nothing else from platform/.
export { parseClientIp } from './clientIp'
export type { ImageRef, ResolvedLink, RichTextValue } from './content'
export { TITLE_MAX_LENGTH } from './contentLimits'
export { formatDuration } from './formatDuration'
export { CONFIRMATION_LINK_LIFETIME_MS } from './linkLifetimes'
export { message, type MessageKey } from './messages'
export { isSingleAddress, parseEmailAddress } from './emailAddress'
export { escapeMarkup } from './escapeMarkup'
export { toGoogleMapsEmbedUrl } from './googleMapsEmbed'
export { toEmailHtml, type OutgoingEmail } from './emailLayout'
export {
  cursorAfterLast,
  encodeCursor,
  parseCursor,
  type SortCursor,
  type SortOrder,
} from './cursor'
export { MAX_PAGE, parsePageNumber, toPageNumbers, type FeedMore, type FeedPage } from './paging'
export { RETENTION, toConfirmedCutoff, toUnconfirmedCutoff } from './retention'
export { AUDIENCES, MODERATION_STATUSES, type Audience, type ModerationStatus } from './reviewQueue'
export { ACCOUNTS_COLLECTION, ROLES, type Role } from './roles'
export { SlidingWindowCounter } from './slidingWindow'
export {
  HUMAN_CHECK_TOKEN_HEADER,
  TURNSTILE_ACTION,
  type HumanCheck,
  type HumanVerifier,
} from './humanCheck'
export type { ActionResult } from './actionResult'
