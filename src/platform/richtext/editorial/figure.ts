import type { FigureBlock as StoredFigure } from '@/payload-types'

import type { FigureProps } from '@/platform/ui/Figure'

import { toDiagramKeyProps } from './diagramKey'

/**
 * The stored block as the figure's props. Empty text is left out, so the figure draws no empty
 * badge or caption, and a key whose markers are all empty is no key.
 */
export function toFigureProps(
  stored: Pick<
    StoredFigure,
    'image' | 'title' | 'label' | 'caption' | 'longCaption' | 'size' | 'items'
  >,
): FigureProps {
  return {
    resource: stored.image,
    title: stored.title.trim(),
    label: stored.label?.trim() || undefined,
    caption: stored.caption?.trim() || undefined,
    longCaption: stored.longCaption?.trim() || undefined,
    size: stored.size ?? undefined,
    items: toDiagramKeyProps({ items: stored.items ?? [] }).items,
  }
}
