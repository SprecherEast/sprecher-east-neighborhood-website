import { headers } from 'next/headers'
import { notFound, redirect } from 'next/navigation'

import { parseSocialProvider } from '@/modules/accounts'
import { startSocialSignIn } from '@/modules/accounts/server'
import { parseClientIp } from '@/platform/lib'

// A sign-in with Google starts here (#188): the accounts module keeps its checks in
// this browser, then the person goes to the provider.
export const dynamic = 'force-dynamic'

export async function GET(_: Request, ctx: RouteContext<'/auth/[provider]'>): Promise<never> {
  const provider = parseSocialProvider((await ctx.params).provider)
  if (!provider) notFound()
  redirect(await startSocialSignIn(provider, parseClientIp(await headers())))
}
