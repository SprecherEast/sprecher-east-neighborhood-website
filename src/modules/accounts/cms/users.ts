import type { CollectionConfig } from 'payload'

import { ROLES } from '@/platform/lib'
import { getServerSideURL } from '@/platform/lib/getURL'
import {
  isAdmin,
  isAdminFieldAccess,
  isAdminOrEditorBoolean,
  isAdminOrSelf,
  serverOnlyFieldAccess,
} from '@/platform/payload/roles'

import { RESET_LINK_LIFETIME_MS } from '../domain/linkLifetimes'
import { toResetPasswordEmail, toResetPasswordLink } from '../domain/resetEmail'
import { USERS } from '../domain/usersCollection'
import { toVerifyAccountEmail, toVerifyAccountLink } from '../domain/verifyAccountEmail'
import { firstAccountIsAdmin } from './firstAccountIsAdmin'
import { forgotPasswordFromSiteOnly } from './forgotPasswordFromSiteOnly'
import { verifyEndpointFromSiteOnly } from './verifyFromSiteOnly'
import { noPasswordSignInForAgents } from './noPasswordSignInForAgents'
import { noResetEmailWhileUnverified } from './noResetEmailWhileUnverified'
import { requireConfirmedEmailChange } from './requireConfirmedEmailChange'
import { requireCurrentPassword } from './requireCurrentPassword'

/** The reset email for a token Payload just made: its link opens the site's reset page. */
const resetEmailFor = (token = '') =>
  toResetPasswordEmail(toResetPasswordLink(getServerSideURL(), token))

/** The verification email for a new account's token: its link opens the site's verify page. */
const verifyEmailFor = (token = '') =>
  toVerifyAccountEmail(toVerifyAccountLink(getServerSideURL(), token))

export const Users: CollectionConfig = {
  slug: USERS,
  access: {
    admin: isAdminOrEditorBoolean,
    create: isAdmin,
    delete: isAdmin,
    read: isAdminOrSelf,
    // Payload's default lets any account unlock any other, undoing the login lockout (#140)
    unlock: isAdmin,
    update: isAdminOrSelf,
  },
  // Payload's REST verify answers 403: accounts are verified only from the site's page, after the
  // robot check (#303). The GraphQL mutation is refused in payload.config.ts (`noVerifyMutation`).
  endpoints: [verifyEndpointFromSiteOnly],
  admin: {
    defaultColumns: ['name', 'email', 'role'],
    useAsTitle: 'name',
  },
  auth: {
    cookies: {
      // Secure in production, so browsers send the sign-in cookie over HTTPS only (#234). Decided
      // by NODE_ENV rather than the server URL: a production build is secure even if the URL is
      // misconfigured as http, while `next dev` on http://localhost still signs in. Signing in
      // over plain http in production (the IP on port 80) stops working, on purpose.
      secure: process.env.NODE_ENV === 'production',
    },
    // Payload's forgot-password email, branded and linking to the site's /reset-password page
    // instead of /admin/reset, so residents never land in the admin (#269). The link uses the
    // configured site address, never the request's Host header.
    forgotPassword: {
      expiration: RESET_LINK_LIFETIME_MS,
      generateEmailHTML: (args) => resetEmailFor(args?.token).html,
      generateEmailSubject: (args) => resetEmailFor(args?.token).subject,
    },
    // A new account can't sign in until its email is verified through Payload's one-time link
    // (#187), branded and linking to the site's /verify-account page instead of the admin.
    // Accounts from before this are marked verified by the migration that turned it on.
    verify: {
      generateEmailHTML: (args) => verifyEmailFor(args?.token).html,
      generateEmailSubject: (args) => verifyEmailFor(args?.token).subject,
    },
  },
  hooks: {
    // Your own password changes only on /account, after your current one is checked (#233), and
    // your own email only through the confirm-by-link flow (#555)
    beforeChange: [firstAccountIsAdmin, requireCurrentPassword, requireConfirmedEmailChange],
    // An agent's MCP API key is its only credential (#336)
    beforeLogin: [noPasswordSignInForAgents],
    // Forgot password only from the site's page (#282), then no reset email to an account whose
    // email isn't verified yet (#187). The site-only check runs first, so a refused request never
    // reaches the account lookup.
    beforeOperation: [forgotPasswordFromSiteOnly, noResetEmailWhileUnverified],
  },
  fields: [
    {
      name: 'name',
      type: 'text',
    },
    {
      name: 'role',
      type: 'select',
      required: true,
      defaultValue: ROLES.guest,
      options: [
        { label: 'Admin', value: ROLES.admin },
        { label: 'Editor', value: ROLES.editor },
        // The default: an account whose home address nobody has verified (#520)
        { label: 'Guest', value: ROLES.guest },
        // A verified neighbour; how an address is verified is #314
        { label: 'Resident', value: ROLES.resident },
        // Suggests events and posts through its MCP API key only; no admin panel, no password
        // sign-in (#336)
        { label: 'Agent', value: ROLES.agent },
      ],
      access: {
        create: isAdminFieldAccess,
        update: isAdminFieldAccess,
        read: () => true,
      },
      admin: {
        position: 'sidebar',
        description: 'Controls access level. Only admins can change roles.',
      },
    },
    // How often this account's verification email was sent again, and since when (#289). Only
    // the server reads and writes them: hidden from the API and the admin panel, and a guest's
    // own update can't set them (#299).
    {
      name: 'verificationResends',
      type: 'number',
      defaultValue: 0,
      hidden: true,
      access: serverOnlyFieldAccess,
    },
    { name: 'verificationResendsSince', type: 'date', hidden: true, access: serverOnlyFieldAccess },
    // Set when a link is resent: the password from the first sign-up may not be this person's,
    // so the verify page has them choose one before the account opens (#289)
    {
      name: 'verificationSetsPassword',
      type: 'checkbox',
      defaultValue: false,
      hidden: true,
      access: serverOnlyFieldAccess,
    },
    // The hash of the link that verified this account. Payload clears its token once used, so
    // without it a link opened again can't be told from a bad one (#391). A hash, so a database
    // copy holds no working link; it only lets the verify page say "already confirmed".
    {
      name: 'verifiedTokenHash',
      type: 'text',
      index: true,
      hidden: true,
      access: serverOnlyFieldAccess,
    },
  ],
  timestamps: true,
}
