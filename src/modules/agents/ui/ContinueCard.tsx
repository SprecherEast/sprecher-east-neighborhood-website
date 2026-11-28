import { Button } from '@/platform/ui'
import { Text } from '@/platform/ui/Text'

import type { Continuing } from '../use-cases/oauth/beginAuthorization'
import { ConnectionCard } from './ConnectionCard'

type Props = { view: Extract<Continuing, { kind: 'continue' }> }

/**
 * The first page of a connection (#1501), opened from the AI tool's own site: who is asking and
 * where it returns to, and the way to the approval. Nothing about any account: this page reads no
 * session, and the approval, on the next page, ignores a session from another site
 * (`isFromAnotherSite`).
 * The way on is a link, so it works before the page has hydrated.
 */
export function ContinueCard({ view }: Props) {
  return (
    <ConnectionCard client={view}>
      <Text variant="small">
        This tool would like to use our AI agent address. An admin approves it on the next step.
      </Text>
      <Button href={view.next} prefetch={false} fullWidth="mobile">
        Continue to approval
      </Button>
    </ConnectionCard>
  )
}
