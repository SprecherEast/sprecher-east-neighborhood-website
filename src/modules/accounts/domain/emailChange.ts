/**
 * The request-context key that marks an email change whose new address was confirmed by link
 * (#555, built in #553's change-your-email flow). Only server code can set it: Payload starts
 * every REST and GraphQL request with an empty context.
 */
export const NEW_EMAIL_CONFIRMED = 'accounts.newEmailConfirmed'

/** What anyone changing their own email any other way is told: REST, GraphQL or `/admin`. */
export const EMAIL_CHANGE_NOT_ALLOWED =
  'Your email can’t be changed this way. Ask an admin for help.'
