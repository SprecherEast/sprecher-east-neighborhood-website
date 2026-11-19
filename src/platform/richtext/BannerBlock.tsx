import type { BannerBlock as BannerBlockProps } from '@/payload-types'

import { cn } from '@/platform/lib/cn'
import { isBannerExpired } from '@/platform/lib/bannerExpiry'
import { Alert } from '@/platform/ui/Alert'
import { Dismissible } from '@/platform/ui/Dismissible.client'
import React from 'react'
import { RichText } from './RichText'

type Props = {
  className?: string
} & BannerBlockProps

// A banner is part of the post, read in its place: not announced like a form's message
export const BannerBlock: React.FC<Props> = ({
  className,
  content,
  style,
  id,
  dismissible,
  showUntil,
}) => {
  // Hidden on the server after its end time; pages refresh every 10 minutes (revalidate = 600)
  if (isBannerExpired(showUntil, new Date())) return null

  const alert = (
    <Alert
      tone={style}
      live={false}
      // The icon sits on the first line of the larger text; room on the right for the close button
      className={cn(
        'mx-auto my-8 w-full px-6 py-3 text-base [&>svg]:mt-1',
        dismissible && 'pr-14',
        className,
      )}
    >
      <RichText data={content} enableGutter={false} enableProse={false} />
    </Alert>
  )

  // A block without an id can't be remembered as closed, so it shows without a close button
  if (!dismissible || !id) return alert
  return (
    <Dismissible id={id} showUntil={showUntil}>
      {alert}
    </Dismissible>
  )
}
