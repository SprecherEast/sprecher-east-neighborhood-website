/**
 * The `context` key the sign-up's create sets, so the first-account rule skips it: the public
 * sign-up always makes a guest, and only Payload's own first registration makes an admin (#354).
 */
export const SIGN_UP_CONTEXT = 'signUp'
