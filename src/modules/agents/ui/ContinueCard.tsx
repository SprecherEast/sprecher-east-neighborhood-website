import { Button } from '@/platform/ui'
import { Card } from '@/platform/ui/Card'
import { MetaList } from '@/platform/ui/MetaList'
import { Text } from '@/platform/ui/Text'

import type { Continuing } from '../use-cases/oauth/beginAuthorization'

type Props = { view: Extract<Continuing, { kind: 'continue' }> }

/**
 * The first page of a connection (#1501), opened from the AI tool's own site: who is asking and
 * where it returns to, and the way to the approval. Nothing about any account: the browser
 * withholds the session on this visit, and the approval is on the next page, from our own site.
 */
export function ContinueCard({ view }: Props) {
  return (
    <Card variant="elevated" padding="lg" className="space-y-6">
      <MetaList
        items={[
          {
            label: 'AI tool',
            value: (
              <Text variant="subsection" as="p">
                {view.clientName}
              </Text>
            ),
          },
          {
            label: 'Returns to',
            value: (
              <Text variant="lead" as="p" className="break-all">
                {view.redirectHost}
              </Text>
            ),
          },
        ]}
      />
      <Text variant="small">
        This tool would like to use our AI agent address. An admin approves it on the next step.
      </Text>
      <Button href={view.next} prefetch={false} fullWidth="mobile">
        Continue to approval
      </Button>
    </Card>
  )
}
