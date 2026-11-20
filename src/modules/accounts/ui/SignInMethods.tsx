import { message } from '@/platform/lib'
import { TextDivider } from '@/platform/ui/TextDivider'
import React from 'react'

/**
 * The quick ways to get in (a passkey, Google), grouped at the top of the log in and sign-up pages
 * with one divider line under them, before the email and password form that stays as the fallback
 * (#1365). The fewest steps come first. A way that shows only once the browser has answered (the
 * passkey) may leave the list empty: then the class below hides the group and its divider, so no
 * empty line is left. The group is a flex column, so the page's own gap spaces it and a hidden
 * group leaves no extra space.
 */
export function SignInMethods({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-6 has-[>[data-sign-in-methods]:empty]:hidden">
      <div data-sign-in-methods className="space-y-3">
        {children}
      </div>
      <TextDivider>{message('accounts.login.otherWay')}</TextDivider>
    </div>
  )
}
