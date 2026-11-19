'use client'

import type { PayloadAdminBarProps, PayloadMeUser } from '@payloadcms/admin-bar'

import { cn } from '@/platform/lib/cn'
import { PayloadAdminBar } from '@payloadcms/admin-bar'
import React, { useState } from 'react'
import { useRouter, useSelectedLayoutSegments } from 'next/navigation'

import './AdminBar.scss'

import { isStaffRole } from '@/platform/payload/roles'
import { getClientSideURL } from '@/platform/lib/getURL'

const baseClass = 'admin-bar'

const collectionLabels = {
  pages: {
    plural: 'Pages',
    singular: 'Page',
  },
  posts: {
    plural: 'Posts',
    singular: 'Post',
  },
}

type LabelledCollection = keyof typeof collectionLabels

/** Own keys only, so a segment like `constructor` doesn't count as a collection */
const isLabelled = (segment: string | undefined): segment is LabelledCollection =>
  segment !== undefined && Object.hasOwn(collectionLabels, segment)

const Title: React.FC = () => <span>Dashboard</span>

export const AdminBar: React.FC<{
  adminBarProps?: PayloadAdminBarProps
}> = (props) => {
  const { adminBarProps } = props || {}
  const segments = useSelectedLayoutSegments()
  const [show, setShow] = useState(false)
  const segment = segments?.[1]
  const collection: LabelledCollection = isLabelled(segment) ? segment : 'pages'
  const router = useRouter()

  // Staff only (#203): residents are signed in too, but can't use the admin. The bar's user type
  // leaves out `role`, though /api/users/me returns it
  const onAuthChange = React.useCallback((user: PayloadMeUser) => {
    setShow(isStaffRole(user && 'role' in user ? user.role : null))
  }, [])

  return (
    <div
      className={cn(baseClass, 'bg-inverse py-2 text-inverse-foreground', {
        block: show,
        hidden: !show,
      })}
    >
      <div className="container">
        <PayloadAdminBar
          {...adminBarProps}
          className="py-2 text-inverse-foreground"
          classNames={{
            controls: 'font-medium text-inverse-foreground',
            logo: 'text-inverse-foreground',
            user: 'text-inverse-foreground',
          }}
          cmsURL={getClientSideURL()}
          collectionSlug={collection}
          collectionLabels={{
            plural: collectionLabels[collection]?.plural || 'Pages',
            singular: collectionLabels[collection]?.singular || 'Page',
          }}
          logo={<Title />}
          onAuthChange={onAuthChange}
          onPreviewExit={() => {
            fetch('/next/exit-preview').then(() => {
              router.push('/')
              router.refresh()
            })
          }}
          // Payload's bar sets its own inline styles; this prop is the only way to undo them
          style={{
            backgroundColor: 'transparent',
            padding: 0,
            position: 'relative',
            zIndex: 'unset',
          }}
        />
      </div>
    </div>
  )
}
