/*
 * The colors of a whole's slices, in one place so a bar and the receipt under it can never differ
 * (#1111): the City's slice in the theme's green and the others in three grays, the lightest first.
 * Each tone has the bar's fill and the receipt's small square.
 */
export const SHARE_TONES = {
  highlight: { fill: 'fill-primary/30', swatch: 'bg-primary/30 border border-primary/50' },
  strong: { fill: 'fill-muted-foreground/45', swatch: 'bg-muted-foreground/45' },
  medium: { fill: 'fill-muted-foreground/30', swatch: 'bg-muted-foreground/30' },
  light: { fill: 'fill-muted-foreground/18', swatch: 'bg-muted-foreground/18' },
} as const

export type ShareTone = keyof typeof SHARE_TONES
