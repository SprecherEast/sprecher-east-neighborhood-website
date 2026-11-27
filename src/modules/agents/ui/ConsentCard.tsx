import { Card } from '@/platform/ui/Card'
import { MetaList } from '@/platform/ui/MetaList'
import { Text } from '@/platform/ui/Text'

import type { ConsentView } from '../use-cases/oauth/beginAuthorization'
import { ConsentButtons } from './ConsentButtons.client'

/**
 * What an admin approves: which tool, where it returns to and which agent account it acts as.
 * The access it gets is that account's, the same as an API key for it (#1501).
 */
export function ConsentCard({ view }: { view: ConsentView }) {
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
          {
            label: 'Acts as',
            value: (
              <Text variant="lead" as="p">
                {view.agentName ?? 'The agent account'}
              </Text>
            ),
          },
        ]}
      />
      <Text variant="small">
        It can read published events and posts and suggest drafts for us to review. It can’t
        publish. Remove it any time in Admin.
      </Text>
      <ConsentButtons view={view} />
    </Card>
  )
}
