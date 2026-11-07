import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { withPayload } from '@payloadcms/next/withPayload'
import { PHASE_PRODUCTION_BUILD } from 'next/constants.js'

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

/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    // Pin the Turnstile site key at build time for server AND browser code. Next only inlines
    // NEXT_PUBLIC_* values that exist at build; when unset, server code would read a key added
    // later to .env.local (check on) while the browser bundle has none (no widget). `env`
    // entries are inlined even when empty, so both sides always agree.
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? '',
  },
  images: {
    // Uploads are served by Payload under this path; getMediaUrl keeps them relative (local)
    localPatterns: [{ pathname: '/api/media/file/**' }],
    // ImageMedia asks for quality 100, and the page backdrop (PageBackdrop) for 50; Next 16 allows
    // only 75 unless listed
    qualities: [50, 100],
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
  headers: async () => API_HEADERS,
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

const config = withPayload(nextConfig, { devBundleServerPackages: false })

export default function nextConfigForPhase(phase) {
  if (phase === PHASE_PRODUCTION_BUILD) assertTurnstileKeysPaired()
  return config
}
