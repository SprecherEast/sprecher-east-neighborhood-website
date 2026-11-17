import React from 'react'

import { cn } from '@/platform/lib/cn'

/*
 * The frosted-glass panel, one look in light and dark (#1278): rounded, a faint `on-image` border
 * and tint, a soft shadow with an inner top edge, a blur of whatever is behind, a sheen from the
 * top left and a glow along the top edge. Its content is `on-image` text.
 *
 * It carries its own darkening layer, the `scrim` token under the glass, so its text passes AA
 * wherever it sits, over a white photo too (`GLASS_SCRIM_ALPHA`, checked in its test). The blur
 * is on the panel itself, so it blurs what is behind, then the layer darkens it, then the glass
 * lies on top. There is no variant for the look.
 */
export interface GlassPanelProps {
  children: React.ReactNode
  /** Layout only (margin, width); never the glass */
  className?: string
}

export function GlassPanel({ children, className }: GlassPanelProps) {
  return (
    <div
      // Marks the glass, so the rail's text plates skip it and the photo shows through (#1268)
      data-glass-panel
      className={cn(
        'relative overflow-hidden rounded-xl border border-on-image/20 px-4 py-3 text-on-image shadow-[0_8px_32px_color-mix(in_srgb,var(--scrim)_30%,transparent),inset_0_1px_0_color-mix(in_srgb,var(--on-image)_20%,transparent)] backdrop-blur-xl md:px-5 md:py-3.5',
        className,
      )}
    >
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-scrim/80" />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-on-image/10" />
      {/* A sheen from the top left, and a glow along the top edge */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-on-image/15 via-transparent to-on-image/5"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-on-image/40 to-transparent"
      />
      <div className="relative">{children}</div>
    </div>
  )
}
