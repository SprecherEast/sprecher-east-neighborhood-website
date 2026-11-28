import { Alert } from '@/platform/ui/Alert'
import { Button } from '@/platform/ui'

import type { Beginning } from '../use-cases/oauth/beginAuthorization'

type Notice = Exclude<Beginning, { kind: 'consent' | 'redirect' }>

/** Why the page shows no approval: a bad request, too many tries, nobody signed in, or not an admin. */
export function ConnectionNotice({
  notice,
  signInHref,
}: {
  notice: Notice
  /** Where "Log in" goes; the page that can ask a visitor to log in gives it */
  signInHref?: string
}) {
  if (notice.kind === 'refused') return <Alert tone="error">{notice.message}</Alert>
  if (notice.kind === 'admin-needed') {
    return (
      <Alert tone="warning">
        Only an admin can allow this. Log in with an admin account, then connect again from the AI
        tool.
      </Alert>
    )
  }
  if (notice.kind === 'too-many') {
    return (
      <Alert tone="warning">That was a lot of tries. Please wait a minute, then start again.</Alert>
    )
  }
  return (
    <div className="space-y-4">
      <Alert tone="info">Log in with an admin account, and we’ll bring you back here.</Alert>
      {signInHref && <Button href={signInHref}>Log in</Button>}
    </div>
  )
}
