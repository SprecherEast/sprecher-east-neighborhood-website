import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { withPayload } from '@payloadcms/next/withPayload'
import { PHASE_PRODUCTION_BUILD } from 'next/constants.js'

import { IMAGE_QUALITIES } from './src/imageQualities.js'
import redirects from './redirects.js'

const NEXT_PUBLIC_SERVER_URL =
  process.env.NEXT_PUBLIC_SERVER_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : undefined) ||
  process.env.__NEXT_PRIVATE_ORIGIN ||
  'http://localhost:3000'

/**
 * Raw API answers stay out of search results (#280): every `/api/` response but the uploads under
 * `/api/media/file/`, so the site's images stay in image search. robots.txt must not block `/api/`
 * instead, or crawlers would never read this header, and images would drop out. It only asks
 * search engines; access control is what keeps private data private.
 */
export const API_HEADERS = [
  {
    source: '/api/:path((?!media/file/).*)',
    headers: [{ key: 'X-Robots-Tag', value: 'noindex' }],
  },
]

/**
 * Pages that are never shown inside another site's frame (decision 0021): `frame-ancestors 'none'`,
 * the modern form of `X-Frame-Options: DENY`. A passkey is made, and used to log in, on a page the
 * person sees, and a framed page could be made to look like something else. The account page and
 * the log in page, the two screens that make or use a passkey, and the password step that connects
 * Google (#1338), and the two pages where an admin allows an AI tool in (#1501), above all the
 * approval, which reads the session on a request from the same site (a sibling subdomain, such as a
 * pull request preview, passes that test): a framed approval button could be clicked by someone who
 * only thinks they are pressing something else. The app sends no other `Content-Security-Policy` and none of its own headers
 * come from a proxy, so this is the one place; Payload adds none for these paths.
 */
export const NO_FRAMING_PATHS = [
  '/account',
  '/login',
  '/auth/:provider/connect',
  '/oauth/authorize',
  '/oauth/approve',
]
export const NO_FRAMING_HEADERS = NO_FRAMING_PATHS.map((source) => ({
  source,
  headers: [{ key: 'Content-Security-Policy', value: "frame-ancestors 'none'" }],
}))

/**
 * The OAuth discovery documents (#1501) must answer under `/.well-known/` at the site root, where
 * MCP clients look (RFC 8414), and the protected-resource one with the resource's path added, as
 * RFC 9728 says: a document answers only for the resource whose path it is fetched with, so every
 * other path under it is left to the 404 page. The routes live under `/oauth/discovery/`, since `src/app` has no dot folders.
 */
export const WELL_KNOWN_REWRITES = [
  {
    source: '/.well-known/oauth-protected-resource/api/mcp',
    destination: '/oauth/discovery/protected-resource',
  },
  {
    source: '/.well-known/oauth-authorization-server',
    destination: '/oauth/discovery/authorization-server',
  },
]

/**
 * Payload adds `Critical-CH: Sec-CH-Prefers-Color-Scheme` to every route for its admin dark mode.
 * On a visitor's first request Chrome (without the hint yet) answers a Critical-CH header by
 * loading the page again, and the second load loses the `#fragment`, so "Estimate your tax split"
 * opened the first tab (#1309). Only the admin needs the hint, so everywhere else the header goes.
 */
export const ADMIN_PATH = '/admin/:path*'
export function criticalHintForAdminOnly(entries) {
  const hint = []
  const rest = entries.map((entry) => {
    const kept = entry.headers.filter(({ key }) => key.toLowerCase() !== 'critical-ch')
    hint.push(...entry.headers.filter(({ key }) => key.toLowerCase() === 'critical-ch'))
    return { ...entry, headers: kept }
  })
  return hint.length ? [...rest, { source: ADMIN_PATH, headers: hint.slice(0, 1) }] : rest
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    // Pin the Turnstile site key at build time for server AND browser code. Next only inlines
    // NEXT_PUBLIC_* values that exist at build; when unset, server code would read a key added
    // later to .env.local (check on) while the browser bundle has none (no widget). `env`
    // entries are inlined even when empty, so both sides always agree.
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? '',
    // The visit counter's site ID (#950), pinned the same way; empty means no counting
    NEXT_PUBLIC_UMAMI_WEBSITE_ID: process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID ?? '',
  },
  images: {
    // Uploads are served by Payload under this path; getMediaUrl keeps them relative (local)
    localPatterns: [{ pathname: '/api/media/file/**' }],
    // Next 16 allows only 75 unless listed: the qualities the UI kit asks for (src/imageQualities.js)
    qualities: Object.values(IMAGE_QUALITIES),
    remotePatterns: [
      ...[NEXT_PUBLIC_SERVER_URL /* 'https://example.com' */].map((item) => {
        const url = new URL(item)

        return {
          hostname: url.hostname,
          protocol: url.protocol.replace(':', ''),
        }
      }),
    ],
  },
  webpack: (webpackConfig) => {
    webpackConfig.resolve.extensionAlias = {
      '.cjs': ['.cts', '.cjs'],
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
      '.mjs': ['.mts', '.mjs'],
    }

    return webpackConfig
  },
  // `next dev` prints every server action call with its arguments, which would put the passwords
  // typed into sign-in and change-password in the terminal, and in any log pasted into an issue
  logging: { serverFunctions: false },
  reactStrictMode: true,
  redirects,
  rewrites: async () => WELL_KNOWN_REWRITES,
  headers: async () => [...API_HEADERS, ...NO_FRAMING_HEADERS],
  // CI type-checks every PR with `tsc --noEmit` (the required "Type-check & Build" check), so
  // `next build` skips its own type check. On the 1-CPU server that step took over 8 minutes and
  // pushed the deploy past its time limit (#246)
  typescript: { ignoreBuildErrors: true },
  turbopack: {
    root: path.dirname(fileURLToPath(import.meta.url)),
  },
}

/**
 * Turnstile needs both keys or neither. Half-configured, either visitors are blocked (secret
 * only) or the page shows a check the server never enforces (site key only), so refuse to
 * build. Only at build time: `next start` loads this file too, and throwing there would take
 * the whole site down on a restart.
 */
function assertTurnstileKeysPaired() {
  const siteKey = Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY)
  const secret = Boolean(process.env.TURNSTILE_SECRET_KEY)
  if (siteKey !== secret) {
    throw new Error(
      `[turnstile] Only ${siteKey ? 'NEXT_PUBLIC_TURNSTILE_SITE_KEY' : 'TURNSTILE_SECRET_KEY'} is set. ` +
        'Set both Turnstile keys, or neither, then build again (see .env.local.example).',
    )
  }
}

const payloadConfig = withPayload(nextConfig, { devBundleServerPackages: false })
const config = {
  ...payloadConfig,
  headers: async () => criticalHintForAdminOnly(await payloadConfig.headers()),
}

export default function nextConfigForPhase(phase) {
  if (phase === PHASE_PRODUCTION_BUILD) assertTurnstileKeysPaired()
  return config
}
