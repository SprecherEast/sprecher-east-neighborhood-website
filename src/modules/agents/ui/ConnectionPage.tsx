import type { ReactNode } from 'react'

import { PageHeader } from '@/platform/ui/PageHeader'
import { Section } from '@/platform/ui/Section'

import type { RawParams } from '../domain/oauth/authorizeRequest'
import { CONNECTION_DESCRIPTION } from '../domain/oauth/constants'

/** What Next hands both pages of a connection: the request's query. */
export type ConnectionPageProps = { searchParams: Promise<RawParams> }

/**
 * The frame both pages of a connection share (#1501): a narrow, centred section with a compact
 * header, and what the page shows below it.
 */
export function ConnectionPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Section as="div" width="narrow" spacing="center">
      <PageHeader variant="compact" title={title} description={CONNECTION_DESCRIPTION} />
      {children}
    </Section>
  )
}
