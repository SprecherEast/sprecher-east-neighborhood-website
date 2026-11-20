import React from 'react'

import { BrandLogo } from '@/platform/ui/BrandLogo'
import { Button } from '@/platform/ui/Button'
import { TextDivider } from '@/platform/ui/TextDivider'

import { GalleryEntry, GalleryVariant } from './GalleryEntry'

/** The sign-in logos on their buttons, and the divider that sets them off from a form (#1365) */
export function BrandLogoGallery() {
  return (
    <>
      <GalleryEntry
        name="BrandLogo"
        description="Each mark is kept exactly as its owner supplies it: no recolour, filter or shadow, in light or dark."
      >
        <GalleryVariant label="google, on a secondary full-width button">
          <div className="max-w-sm">
            <Button
              type="button"
              variant="secondary"
              fullWidth
              iconStart={<BrandLogo brand="google" />}
            >
              Continue with Google
            </Button>
          </div>
        </GalleryVariant>
      </GalleryEntry>
      <GalleryEntry name="TextDivider">
        <GalleryVariant label="between the quick ways in and a form">
          <div className="max-w-sm space-y-6">
            <Button
              type="button"
              variant="secondary"
              fullWidth
              iconStart={<BrandLogo brand="google" />}
            >
              Continue with Google
            </Button>
            <TextDivider>Or use your email and password</TextDivider>
          </div>
        </GalleryVariant>
      </GalleryEntry>
    </>
  )
}
