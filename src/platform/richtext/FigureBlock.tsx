import React from 'react'

import type { FigureBlock as StoredFigure } from '@/payload-types'
import { Figure } from '@/platform/ui/Figure'

import { toFigureProps } from './editorial/figure'

/** The editor's "Figure" block, drawn with the shared `Figure` (#817) */
export function FigureBlock({ className, ...stored }: StoredFigure & { className?: string }) {
  return <Figure {...toFigureProps(stored)} className={className} />
}

/**
 * A figure inside a section tab (#1333) follows the article's own picture sizes: full width on a
 * phone, half the content on a tablet, a third from a wide screen, whatever the block's width
 * choice says. It offers Enlarge only when it has something more to show (a key or a long
 * caption), since enlarging a picture that adds nothing is a click to the same picture.
 */
export function PanelFigureBlock({ className, ...stored }: StoredFigure & { className?: string }) {
  const props = toFigureProps(stored)
  const zoom = Boolean(props.items?.length || props.longCaption)
  return <Figure {...props} size="half-then-third" zoom={zoom} className={className} />
}
