import React from 'react'

import type { FigureBlock as StoredFigure } from '@/payload-types'
import { Figure } from '@/platform/ui/Figure'

import { toFigureProps } from './editorial/figure'

/** The editor's "Figure" block, drawn with the shared `Figure` (#817) */
export function FigureBlock({ className, ...stored }: StoredFigure & { className?: string }) {
  return <Figure {...toFigureProps(stored)} className={className} />
}
