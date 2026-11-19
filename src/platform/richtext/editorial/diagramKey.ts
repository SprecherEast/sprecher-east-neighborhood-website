import type { DiagramKeyBlock as StoredDiagramKey } from '@/payload-types'

/** One marker's entry, as the key draws it. */
export type DiagramKeyItem = {
  label: string
  text: string | null
}

/** The diagram key's props: plain data (decision 0013). */
export type DiagramKeyProps = {
  items: DiagramKeyItem[]
}

/**
 * The stored block as the key's props. The numbers come from the order and must match the
 * markers on the image, so a row in the middle is never dropped (that would renumber the rest);
 * only empty rows at the end are, since dropping them changes no number.
 */
export function toDiagramKeyProps(stored: Pick<StoredDiagramKey, 'items'>): DiagramKeyProps {
  const items = (stored.items ?? []).map((item) => ({
    label: item.label?.trim() ?? '',
    text: item.text?.trim() || null,
  }))
  while (items.length > 0 && !items.at(-1)?.label && !items.at(-1)?.text) items.pop()
  return { items }
}
