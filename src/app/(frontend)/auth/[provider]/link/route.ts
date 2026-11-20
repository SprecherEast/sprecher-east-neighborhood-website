import { headers } from 'next/headers'
import { notFound, redirect } from 'next/navigation'

import { parseSocialProvider } from '@/modules/accounts'
import { startSocialSignIn } from '@/modules/accounts/server'
import { parseClientIp } from '@/platform/lib'

// A signed-in neighbor connecting Google to their account starts here (#1338): the same flow as
// signing in, but bound to the session's account, which must be a recent sign-in. The accounts
// module keeps its checks in this browser, then the person goes to the provider.
export const dynamic = 'force-dynamic'

export async function GET(_: Request, ctx: RouteContext<'/auth/[provider]/link'>): Promise<never> {
  const provider = parseSocialProvider((await ctx.params).provider)
  if (!provider) notFound()
  redirect(await startSocialSignIn(provider, parseClientIp(await headers()), { link: true }))
}
