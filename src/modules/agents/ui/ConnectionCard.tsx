import type { ReactNode } from 'react'

import { Card } from '@/platform/ui/Card'

import type { ClientFacts } from '../domain/oauth/types'
import { ConnectionFacts } from './ConnectionFacts'

/**
 * The card both pages of a connection share (#1501): who is asking, then what the page says and
 * does as its children. Only the approval names the agent account.
 */
export function ConnectionCard({
  client,
  agentName,
  children,
}: {
  client: ClientFacts
  agentName?: string
  children: ReactNode
}) {
  return (
    <Card variant="elevated" padding="lg" className="space-y-6">
      <ConnectionFacts client={client} agentName={agentName} />
      {children}
    </Card>
  )
}
