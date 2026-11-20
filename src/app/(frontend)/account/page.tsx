import type { Metadata } from 'next'

import {
  AddPasskey,
  arePasskeysOn,
  ChangePasswordForm,
  requireUser,
} from '@/modules/accounts/server'
import { NOT_INDEXED } from '@/platform/seo/notIndexed'
import { Card } from '@/platform/ui/Card'
import { MetaList } from '@/platform/ui/MetaList'
import { PageHeader } from '@/platform/ui/PageHeader'
import { Section } from '@/platform/ui/Section'
import { Text } from '@/platform/ui/Text'

export const metadata: Metadata = {
  title: 'Account',
  description: 'Manage your Sprecher East account.',
  robots: NOT_INDEXED,
}

export default async function AccountPage() {
  const user = await requireUser()

  return (
    <Section as="div" width="narrow">
      <PageHeader variant="compact" title="Account" />

      <div className="space-y-8">
        <Card as="section" variant="muted">
          <Text variant="subsection" className="mb-4">
            Profile
          </Text>
          <MetaList
            items={[
              { label: 'Name', value: user.name || 'Not set' },
              { label: 'Email', value: <span className="wrap-anywhere">{user.email}</span> },
            ]}
          />
        </Card>

        <Card as="section" variant="muted">
          <Text variant="subsection" className="mb-4">
            Change Password
          </Text>
          <ChangePasswordForm />
        </Card>

        {/* Only when the server switch is on; the card also waits for a browser that can make one */}
        {arePasskeysOn() && <AddPasskey />}
      </div>
    </Section>
  )
}
