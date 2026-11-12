/*
 * The colors of a whole's slices, in one place so a bar and the receipt under it can never differ
 * (#1111): the City's slice in the theme's solid green and the others in three neutral tones, the lightest first.
 * Each tone has the bar's fill, the receipt's small square, the color of the percent written on the
 * slice (#1121: at least 4.5:1 on that fill in both modes, which `shareTones.test.ts` checks from
 * the theme file) and the look of its receipt row: the highlighted one has a soft primary fill and
 * bolder text, so it is not told by color alone.
 */
export const SHARE_TONES = {
  highlight: {
    fill: 'fill-primary-fill',
    swatch: 'bg-primary-fill',
    label: 'fill-primary-foreground',
    row: 'rounded-sm bg-primary/10 font-semibold',
  },
  strong: {
    fill: 'fill-muted-foreground/45',
    swatch: 'bg-muted-foreground/45',
    label: 'fill-foreground',
    row: '',
  },
  medium: {
    fill: 'fill-muted-foreground/30',
    swatch: 'bg-muted-foreground/30',
    label: 'fill-foreground',
    row: '',
  },
  light: {
    fill: 'fill-muted-foreground/18',
    swatch: 'bg-muted-foreground/18',
    label: 'fill-foreground',
    row: '',
  },
} as const

export type ShareTone = keyof typeof SHARE_TONES
