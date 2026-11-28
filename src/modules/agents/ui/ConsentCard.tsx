import { Text } from '@/platform/ui/Text'

import { decideConnectionForm } from '../actions'
import { SCOPE_LABELS, scopeList, scopesOf } from '../domain/scopes'
import type { ConsentView } from '../use-cases/oauth/beginAuthorization'
import { ConnectionCard } from './ConnectionCard'
import { ConsentButtons } from './ConsentButtons.client'

/**
 * What an admin approves: which tool, where it returns to, which agent account it acts as and
 * what it will be able to do (its scopes, #1499). The access it gets is never more than that
 * account's, the same as an API key for it (#1501).
 */
export function ConsentCard({ view }: { view: ConsentView }) {
  return (
    <ConnectionCard
      client={view}
      agentName={view.agentName ?? 'The agent account'}
      abilities={scopesOf(scopeList(view.request.scope)).map((scope) => SCOPE_LABELS[scope])}
    >
      <Text variant="small">It can’t publish. Remove it any time in Admin.</Text>
      <ConsentButtons
        action={decideConnectionForm.bind(null, { request: view.request, ticket: view.ticket })}
      />
    </ConnectionCard>
  )
}
