import React from 'react'

import { cn } from '@/platform/lib/cn'

/*
 * The frosted-glass panel, one look in light and dark (#1278, #1292): rounded, a faint `on-image`
 * border, a soft shadow with an inner top edge, a strong blur of whatever is behind with a little
 * extra color, a faint sheen from the top left and a glow along the top edge. Its content is
 * `on-image` text.
 *
 * It carries its own darkening layer, the `scrim` token under the glass, so its text passes AA
 * wherever it sits, over a white photo too (`GLASS_SCRIM_ALPHA`, checked in its test). The blur
 * is on the panel itself, so it blurs what is behind, then the layer darkens it, then the sheen
 * lies on top. No flat white layer: that turned the panel gray. There is no variant for the look.
 */
export interface GlassPanelProps {
  children: React.ReactNode
  /** Layout only (margin, width); never the glass */
  className?: string
}

export function GlassPanel({ children, className }: GlassPanelProps) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-xl border border-on-image/20 px-4 py-3 text-on-image shadow-[0_8px_32px_color-mix(in_srgb,var(--scrim)_30%,transparent),inset_0_1px_0_color-mix(in_srgb,var(--on-image)_20%,transparent)] backdrop-blur-xl backdrop-saturate-150 md:px-5 md:py-3.5',
        className,
      )}
    >
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-scrim/55" />
      {/* A faint sheen from the top left, and a glow along the top edge */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-on-image/6 via-transparent to-transparent"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-on-image/40 to-transparent"
      />
      <div className="relative">{children}</div>
    </div>
  )
}
