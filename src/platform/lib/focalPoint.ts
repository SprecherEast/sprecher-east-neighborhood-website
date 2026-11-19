/** A picture's focal point as Payload stores it: percent from the left and from the top */
export type FocalPoint = { focalX?: number | null; focalY?: number | null }

const CENTRE = 50

const toPercent = (value: number | null | undefined): number =>
  typeof value === 'number' && Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : CENTRE

/**
 * The CSS `object-position` that keeps a picture's focal point in view when it is cropped
 * (`object-fit: cover`). The centre when the upload has none.
 */
export function toObjectPosition(focal: FocalPoint | null | undefined): string {
  return `${toPercent(focal?.focalX)}% ${toPercent(focal?.focalY)}%`
}
