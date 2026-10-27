import { headers } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import type { NextRequest } from 'next/server'

import { ACCOUNT_PATH, parseSocialProvider } from '@/modules/accounts'
import { continuePage, finishSocialSignIn } from '@/modules/accounts/server'
import { parseClientIp } from '@/platform/lib'

// Google sends the person back here (#188). The accounts module checks the answer
// and answers where they go next: their account once signed in, or the log-in page with a fixed
// message.
export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  ctx: RouteContext<'/auth/[provider]/callback'>,
): Promise<Response> {
  const provider = parseSocialProvider((await ctx.params).provider)
  if (!provider) notFound()
  const ip = parseClientIp(await headers())
  const next = await finishSocialSignIn(provider, request.nextUrl.search, ip)
  // Signed in: a page on this site moves on, so the account page's request isn't cross-site
  if (next === ACCOUNT_PATH) return continuePage(next)
  redirect(next)
}
