import { Card } from '@/platform/ui/Card'
import { Text } from '@/platform/ui/Text'

import type { ConsentView } from '../use-cases/oauth/beginAuthorization'
import { ConnectionFacts } from './ConnectionFacts'
import { ConsentButtons } from './ConsentButtons.client'

/**
 * What an admin approves: which tool, where it returns to and which agent account it acts as.
 * The access it gets is that account's, the same as an API key for it (#1501).
 */
export function ConsentCard({ view }: { view: ConsentView }) {
  return (
    <Card variant="elevated" padding="lg" className="space-y-6">
      <ConnectionFacts
        clientName={view.clientName}
        redirectHost={view.redirectHost}
        agentName={view.agentName ?? 'The agent account'}
      />
      <Text variant="small">
        It can read published events and posts and suggest drafts for us to review. It can’t
        publish. Remove it any time in Admin.
      </Text>
      <ConsentButtons view={view} />
    </Card>
  )
}
