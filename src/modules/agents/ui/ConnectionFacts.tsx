import { MetaList } from '@/platform/ui/MetaList'
import { Text } from '@/platform/ui/Text'

import type { ClientFacts } from '../domain/oauth/types'

/**
 * What both pages of a connection say about the request (#1501): which AI tool, and where it
 * returns to; the approval adds the agent account the tool would act as and what it may do (#1499).
 */
export function ConnectionFacts({
  client: { clientName, redirectHost },
  agentName,
  abilities,
}: {
  client: ClientFacts
  /** Only the approval names it: the first page shows nothing about any account */
  agentName?: string
  /** Only the approval lists them: one line per scope the tool would get */
  abilities?: readonly string[]
}) {
  return (
    <MetaList
      items={[
        {
          label: 'AI tool',
          value: (
            <Text variant="subsection" as="p">
              {clientName}
            </Text>
          ),
        },
        {
          label: 'Returns to',
          value: (
            <Text variant="lead" as="p" className="break-all">
              {redirectHost}
            </Text>
          ),
        },
        ...(agentName === undefined
          ? []
          : [
              {
                label: 'Acts as',
                value: (
                  <Text variant="lead" as="p">
                    {agentName}
                  </Text>
                ),
              },
            ]),
        ...(abilities === undefined
          ? []
          : [
              {
                label: 'It can',
                value: (
                  <MetaList
                    className="gap-1"
                    items={abilities.map((ability) => ({
                      value: (
                        <Text variant="lead" as="p">
                          {ability}
                        </Text>
                      ),
                    }))}
                  />
                ),
              },
            ]),
      ]}
    />
  )
}
