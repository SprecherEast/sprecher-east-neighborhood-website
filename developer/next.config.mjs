import path from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * The developer pages (#1530) are a second, small Next.js project that exports plain files
 * (https://nextjs.org/docs/app/guides/static-exports): ops/developer-site.sh publishes them for
 * Caddy to serve at dev.sprechereast.com, and the site's own app never holds a developer route.
 * `trailingSlash` writes `/showcase/index.html`, which a plain file server answers for `/showcase/`.
 * Next.js's own type check is skipped as in the site's config: CI type-checks the whole repository.
 *
 * @type {import('next').NextConfig}
 */
const config = {
  output: 'export',
  trailingSlash: true,
  // The image optimizer is a server feature: a static export serves the file as it is
  images: { unoptimized: true },
  typescript: { ignoreBuildErrors: true },
  // The pages import the site's UI kit and theme from src/, so the build's root is the repository
  turbopack: { root: path.join(path.dirname(fileURLToPath(import.meta.url)), '..') },
}

export default config
