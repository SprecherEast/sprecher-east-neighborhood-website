'use client'

import { ArrowLeft } from 'lucide-react'
import { useRouter } from 'next/navigation'
import React from 'react'

import { Button } from './Button'
import { Dialog } from './Dialog.client'

type Props = {
  /** Names the dialog and heads it */
  title: string
  /** What the back button says, such as "Back to our plan" */
  backLabel: string
  children: React.ReactNode
}

/*
 * A dialog that is a page of its own (#946): the page that opens it is still behind, and closing
 * it, with the close button, the back button or Escape, goes back one step in the browser's
 * history, so the reader lands where they were. It is meant for an intercepted route, which a
 * direct visit shows as the full page (Next.js parallel and intercepting routes). It is always
 * open: the route being there is what opens it.
 */
export function RouteDialog({ title, backLabel, children }: Props) {
  const router = useRouter()
  const close = () => router.back()

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) close()
      }}
      title={title}
      placement="center"
    >
      <div className="space-y-6 px-6 py-6">
        <Button variant="ghost" size="sm" onClick={close}>
          <ArrowLeft aria-hidden="true" />
          {backLabel}
        </Button>
        {children}
      </div>
    </Dialog>
  )
}
