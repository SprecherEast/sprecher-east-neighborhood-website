import { Alert } from '@/platform/ui/Alert'
import { Button } from '@/platform/ui'

import type { Beginning } from '../use-cases/oauth/beginAuthorization'

type Notice = Exclude<Beginning, { kind: 'consent' | 'redirect' }>

/** Why the consent page shows no approval: a bad request, nobody signed in, or not an admin. */
export function ConnectionNotice({ notice, signInHref }: { notice: Notice; signInHref: string }) {
  if (notice.kind === 'refused') return <Alert tone="error">{notice.message}</Alert>
  if (notice.kind === 'admin-needed') {
    return (
      <Alert tone="warning">
        Only an admin can allow this. Log in with an admin account, then connect again from the AI
        tool.
      </Alert>
    )
  }
  return (
    <div className="space-y-4">
      <Alert tone="info">
        Log in with an admin account first. Then connect again from the AI tool.
      </Alert>
      <Button href={signInHref}>Log in</Button>
    </div>
  )
}
