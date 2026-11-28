import { PAGE_SHELL } from '@/platform/ui/layoutSizes'
import { PageHeader } from '@/platform/ui/PageHeader'

/**
 * What Caddy serves for a path with no page, with the 404 status (ops/caddy/developer-site.caddy rewrites to
 * `/404.html`, the file Next.js writes for this page).
 */
export default function NotFound() {
  return (
    <div className={PAGE_SHELL}>
      <PageHeader
        title="We can’t find that page"
        description="It may have moved, or the address may have a typo."
        backLink={{ href: '/', label: 'Back to the developer home' }}
      />
    </div>
  )
}
