// Types and pure rules only, so the discovery routes and scripts can import it without pulling in
// Payload. The consent page and the token address are in server.ts; collections and plugin
// options are in cms.ts (#1501).
export {
  authorizationServerMetadata,
  discoveryResponse,
  protectedResourceMetadata,
} from './domain/oauth/metadata'
export {
  CONNECTION_DESCRIPTION,
  CONNECTION_REFUSED,
  FORM_CONTENT_TYPE,
  NO_STORE_HEADERS,
  OAUTH_PATHS,
} from './domain/oauth/constants'
export { tokenError, type TokenAnswer } from './domain/oauth/tokenAnswer'
export { MINIMAL_SCOPES } from './domain/scopes'
