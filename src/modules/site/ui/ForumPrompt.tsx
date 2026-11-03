import { ExternalLink } from 'lucide-react'
import React from 'react'

import { cn } from '@/platform/lib/cn'
import { Link } from '@/platform/ui'
import { Text } from '@/platform/ui/Text'
import { READING_WIDTH } from '@/platform/ui/layoutSizes'

export type ForumPromptProps = {
  /** The forum's https address (`getForumUrl`); nothing is drawn without one */
  href: string | null
  className?: string
}

/** The line under a post that sends readers to the neighborhood forum to discuss it (#485). */
export function ForumPrompt({ href, className }: ForumPromptProps) {
  if (!href) return null

  return (
    <aside
      aria-label="Discuss on the forum"
      // Centred, and as wide as the post text above it
      className={cn(
        'mx-auto mt-10 w-full',
        READING_WIDTH,
        'border-t border-border pt-6',
        className,
      )}
    >
      <Text variant="small">Questions or thoughts about this?</Text>
      <Link
        href={href}
        variant="action"
        external
        icon={<ExternalLink aria-hidden="true" />}
        iconPosition="end"
      >
        Talk it over on the neighborhood forum
      </Link>
    </aside>
  )
}
