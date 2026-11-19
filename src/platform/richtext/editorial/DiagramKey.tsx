import React from 'react'

import { Legend } from '@/platform/ui/Legend'

import type { DiagramKeyProps } from './diagramKey'

/**
 * The legend under an annotated image (#515): the editor's "Diagram key" block, drawn with the
 * shared `Legend` (#636), a full-width panel under the image and its caption (#658).
 */
export function DiagramKey({ items, className }: DiagramKeyProps & { className?: string }) {
  return <Legend label="Diagram key" items={items} className={className} />
}
