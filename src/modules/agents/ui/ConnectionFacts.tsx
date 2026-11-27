import { MetaList } from '@/platform/ui/MetaList'
import { Text } from '@/platform/ui/Text'

/**
 * What both pages of a connection say about the request (#1501): which AI tool, and where it
 * returns to; the approval adds the agent account the tool would act as.
 */
export function ConnectionFacts({
  clientName,
  redirectHost,
  agentName,
}: {
  clientName: string
  redirectHost: string
  /** Only the approval names it: the first page shows nothing about any account */
  agentName?: string
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
      ]}
    />
  )
}
