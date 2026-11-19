/** How long a password-reset link works (#551): Payload's `forgotPassword.expiration`, and the lifetime the page tells people. The reset email's own text still says it by hand until it joins the catalog (#551, later PR). */
export const RESET_LINK_LIFETIME_MS = 60 * 60 * 1000
