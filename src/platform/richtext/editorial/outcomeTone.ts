/**
 * Which way an outcome moves the story (#510): `go` (the plan goes ahead), `stop` (it doesn't)
 * or `open` (something else, or it's unclear). It sets the card's icon and tint, and screen
 * readers hear it in words before the outcome's title, so the tone is never only a colour or icon.
 */
export const OUTCOME_TONES = ['go', 'stop', 'open'] as const

export type OutcomeTone = (typeof OUTCOME_TONES)[number]

/** The tone in words, read before the outcome's title by screen readers (the icon is hidden). */
export const OUTCOME_TONE_LABELS: Record<OutcomeTone, string> = {
  go: 'Goes ahead',
  stop: 'Doesn’t go ahead',
  open: 'Other outcome',
}

export const OUTCOME_TONE_OPTIONS = [
  { label: 'Goes ahead', value: 'go' },
  { label: 'Stops', value: 'stop' },
  { label: 'Something else or unclear', value: 'open' },
] satisfies { label: string; value: OutcomeTone }[]

export function isOutcomeTone(value: unknown): value is OutcomeTone {
  return (OUTCOME_TONES as readonly unknown[]).includes(value)
}
