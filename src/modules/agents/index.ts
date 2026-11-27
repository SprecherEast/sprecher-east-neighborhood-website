// Types and pure rules only, so the discovery routes and scripts can import it without pulling in
// Payload. The consent page and the token address are in server.ts; collections and plugin
// options are in cms.ts (#1501).
export { authorizationServerMetadata, protectedResourceMetadata } from './domain/oauth/metadata'
export { OAUTH_PATHS } from './domain/oauth/constants'
