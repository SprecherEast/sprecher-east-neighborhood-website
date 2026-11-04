/**
 * How sure the site is about a fact (#509): `confirmed` by a source, an `estimate` (a range, a
 * plan, a forecast) or `unknown` (nobody has said yet). The key facts block shows it in words
 * beside each value, so "?" or "2040s" never reads as more certain than it is.
 */
export const CERTAINTIES = ['confirmed', 'estimate', 'unknown'] as const

export type Certainty = (typeof CERTAINTIES)[number]

/** The word a reader sees beside the fact. */
export const CERTAINTY_LABELS: Record<Certainty, string> = {
  confirmed: 'Confirmed',
  estimate: 'Estimate',
  unknown: 'Unknown',
}

/** The choice an editor sees, with what each one means. */
export const CERTAINTY_OPTIONS = [
  { label: 'Confirmed: a source says so', value: 'confirmed' },
  { label: 'Estimate: a plan, range or forecast', value: 'estimate' },
  { label: 'Unknown: nobody has said yet', value: 'unknown' },
] satisfies { label: string; value: Certainty }[]

export function isCertainty(value: unknown): value is Certainty {
  return (CERTAINTIES as readonly unknown[]).includes(value)
}
