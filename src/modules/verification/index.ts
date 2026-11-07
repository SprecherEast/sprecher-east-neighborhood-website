// Types and pure rules only, so client components and scripts can import it without pulling in
// Payload. The confirm page's component is in server.ts; the collection and the confirmation
// service are in cms.ts.
export { CONFIRM_EMAIL_PATH } from './domain/paths'
export { parseConfirmationToken } from './domain/tokenFormat'
