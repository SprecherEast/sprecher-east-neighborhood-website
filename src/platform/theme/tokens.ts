/**
 * The theme contract (decisions 0006 and 0012, #146): every semantic token a theme defines.
 * Components use only these, through the Tailwind classes `tailwind.css` maps them to
 * (`bg-background`, `text-muted-foreground`, …), never raw colours. A theme is a CSS file under
 * `src/themes/<name>/theme.css` giving each token a value; `themes.test.ts` checks every theme
 * against this list and the contrast pairs below.
 *
 * The names follow shadcn/ui's convention, so shadcn-format themes fit with little translation.
 */

/** `both`: the theme sets it in light and dark. `base`: set once, the same in both modes. */
type Modes = 'both' | 'base'

export const THEME_TOKENS = {
  background: { modes: 'both', meaning: 'Page background' },
  foreground: { modes: 'both', meaning: 'Body text on the background' },
  card: { modes: 'both', meaning: 'Card background' },
  'card-foreground': { modes: 'both', meaning: 'Text on a card' },
  popover: { modes: 'both', meaning: 'Menus, popovers and dialogs' },
  'popover-foreground': { modes: 'both', meaning: 'Text on a popover' },
  primary: {
    modes: 'both',
    meaning: 'Brand colour: accents, borders, icons, eyebrow and link text',
  },
  'primary-foreground': { modes: 'both', meaning: 'Text on a primary fill' },
  'primary-fill': { modes: 'both', meaning: 'Primary button fill, passes AA with its text' },
  'primary-fill-hover': { modes: 'both', meaning: 'Primary button fill on hover' },
  'primary-strong': { modes: 'both', meaning: 'Primary-coloured text that passes on panels' },
  'primary-dark': { modes: 'both', meaning: 'Darker primary shade' },
  'primary-light': { modes: 'both', meaning: 'Lighter primary shade' },
  secondary: { modes: 'both', meaning: 'Secondary surface' },
  'secondary-foreground': { modes: 'both', meaning: 'Text on a secondary surface' },
  muted: { modes: 'both', meaning: 'Muted surface' },
  'muted-foreground': { modes: 'both', meaning: 'Secondary text' },
  accent: { modes: 'both', meaning: 'Highlight colour' },
  'accent-foreground': { modes: 'both', meaning: 'Text on the accent colour' },
  'accent-dark': { modes: 'both', meaning: 'Darker accent shade (hover)' },
  'accent-strong': {
    modes: 'both',
    meaning: 'Accent text that passes on the page, panels and cards',
  },
  destructive: { modes: 'both', meaning: 'Errors and destructive actions' },
  'destructive-foreground': { modes: 'both', meaning: 'Destructive text (shadcn name)' },
  'destructive-strong': { modes: 'both', meaning: 'Error text that passes on panels' },
  surface: { modes: 'both', meaning: 'Raised panels and alternating sections' },
  border: { modes: 'both', meaning: 'Dividers and card borders' },
  input: { modes: 'both', meaning: 'Form control borders (3:1, WCAG 1.4.11)' },
  ring: { modes: 'both', meaning: 'Focus ring' },
  success: { modes: 'both', meaning: 'Success state' },
  'success-strong': { modes: 'both', meaning: 'Success text that passes on panels' },
  done: { modes: 'both', meaning: 'Finished work: the purple of a done mark' },
  'done-strong': { modes: 'both', meaning: 'Done text that passes on panels' },
  warning: { modes: 'both', meaning: 'Warning state' },
  'warning-strong': { modes: 'both', meaning: 'Warning text that passes on panels' },
  info: { modes: 'both', meaning: 'Information state: notices such as an upcoming meeting' },
  'info-strong': { modes: 'both', meaning: 'Information text that passes on panels' },
  error: { modes: 'both', meaning: 'Error state' },
  'on-image': { modes: 'both', meaning: 'Text and icons on photos (heroes, image cards)' },
  scrim: { modes: 'both', meaning: 'Overlays and shadows that keep text readable on photos' },
  'diagram-marker': {
    modes: 'base',
    meaning: 'The orange of the numbered markers drawn into diagrams; the same in both modes',
  },
  inverse: { modes: 'both', meaning: 'Dark chrome on any page: the admin bar, code blocks' },
  'inverse-foreground': { modes: 'both', meaning: 'Text on the inverse surface' },
  'chart-1': { modes: 'both', meaning: 'Chart series 1' },
  'chart-2': { modes: 'both', meaning: 'Chart series 2' },
  'chart-3': { modes: 'both', meaning: 'Chart series 3' },
  'chart-4': { modes: 'both', meaning: 'Chart series 4' },
  'chart-5': { modes: 'both', meaning: 'Chart series 5' },
  'chart-6': { modes: 'both', meaning: 'Chart series 6' },
  'chart-warm-1': { modes: 'both', meaning: 'Warm chart colour 1: orange and gray' },
  'chart-warm-2': { modes: 'both', meaning: 'Warm chart colour 2: orange and gray' },
  'chart-warm-3': { modes: 'both', meaning: 'Warm chart colour 3: orange and gray' },
  'chart-warm-4': { modes: 'both', meaning: 'Warm chart colour 4: orange and gray' },
  'chart-warm-5': { modes: 'both', meaning: 'Warm chart colour 5: orange and gray' },
  'chart-warm-6': { modes: 'both', meaning: 'Warm chart colour 6: orange and gray' },
  'chart-ramp-1': {
    modes: 'both',
    meaning: 'Breakdown colour step 1 of 7, biggest to smallest: orange, a little less bright',
  },
  'chart-ramp-2': {
    modes: 'both',
    meaning:
      'Breakdown colour step 2 of 7, biggest to smallest: bright orange with a touch of green',
  },
  'chart-ramp-3': {
    modes: 'both',
    meaning: 'Breakdown colour step 3 of 7, biggest to smallest: green with a little white',
  },
  'chart-ramp-4': {
    modes: 'both',
    meaning: 'Breakdown colour step 4 of 7, biggest to smallest: green',
  },
  'chart-ramp-5': {
    modes: 'both',
    meaning: 'Breakdown colour step 5 of 7, biggest to smallest: white',
  },
  'chart-ramp-6': {
    modes: 'both',
    meaning: 'Breakdown colour step 6 of 7, biggest to smallest: gray',
  },
  'chart-ramp-7': {
    modes: 'both',
    meaning: 'Breakdown colour step 7 of 7, biggest to smallest: lighter gray',
  },
  'chart-ramp-edge': {
    modes: 'both',
    meaning: 'The thin outline of every breakdown mark, so the pale steps keep a visible edge',
  },
  radius: { modes: 'base', meaning: 'Base corner radius; sm to xl derive from it' },
  'type-fine': {
    modes: 'base',
    meaning:
      'Finest text size (`text-fine`): the small uppercase labels beside a value, smaller than `text-xs`',
  },
  'type-list-row': {
    modes: 'base',
    meaning:
      'Label size of a row nested in a list (`text-list-row`), relative to the list: a little larger than its rows, smaller than a stand-alone row label',
  },
} as const satisfies Record<string, { modes: Modes; meaning: string }>

export type ThemeToken = keyof typeof THEME_TOKENS

export const THEME_TOKEN_NAMES = Object.keys(THEME_TOKENS) as ThemeToken[]

/**
 * Text-on-background pairs every theme must pass at WCAG AA (4.5:1) in both modes. Each pair is
 * one the components actually draw. `primary-foreground` on plain `primary` isn't one: buttons
 * use `primary-fill`, because dark `primary` gives white text only 3.35:1 (#121).
 */
export const CONTRAST_PAIRS: ReadonlyArray<readonly [text: ThemeToken, background: ThemeToken]> = [
  ['foreground', 'background'],
  ['foreground', 'surface'],
  ['card-foreground', 'card'],
  ['popover-foreground', 'popover'],
  ['secondary-foreground', 'secondary'],
  ['muted-foreground', 'background'],
  ['muted-foreground', 'surface'],
  ['muted-foreground', 'card'],
  ['muted-foreground', 'muted'],
  ['primary-foreground', 'primary-fill'],
  ['primary-foreground', 'primary-fill-hover'],
  ['accent-foreground', 'accent'],
  ['accent-strong', 'background'],
  ['accent-strong', 'surface'],
  ['accent-strong', 'card'],
  ['primary-strong', 'background'],
  ['primary-strong', 'surface'],
  ['primary-strong', 'card'],
  ['destructive-strong', 'background'],
  ['destructive-strong', 'surface'],
  ['destructive-strong', 'card'],
  // Plain primary and destructive are text too: eyebrows, the logo, links, a paging error (#386)
  ['primary', 'background'],
  ['primary', 'card'],
  ['destructive', 'background'],
  ['on-image', 'scrim'],
  ['inverse-foreground', 'inverse'],
  ['warning-strong', 'background'],
  ['warning-strong', 'surface'],
  ['warning-strong', 'card'],
  ['info-strong', 'background'],
  ['info-strong', 'surface'],
  ['info-strong', 'card'],
  ['success-strong', 'background'],
  ['success-strong', 'surface'],
  ['success-strong', 'card'],
  ['done-strong', 'background'],
  ['done-strong', 'surface'],
  ['done-strong', 'card'],
  // An outcome fork's "open" card: body text on the muted surface (#510)
  ['foreground', 'muted'],
]

/** WCAG 1.4.11 minimum for graphics: chart marks, icons, control borders. */
export const MIN_GRAPHIC_CONTRAST = 3

/**
 * Chart marks (#659): each chart colour against every surface a chart sits on, at 3:1 in both
 * modes. Use the slots in order (1 to 6): adjacent pairs are only clean that way. Text never sits
 * on a mark; values and labels use the text tokens.
 */
const CHART_TOKENS = [
  'chart-1',
  'chart-2',
  'chart-3',
  'chart-4',
  'chart-5',
  'chart-6',
] as const satisfies readonly ThemeToken[]
const CHART_WARM_TOKENS = [
  'chart-warm-1',
  'chart-warm-2',
  'chart-warm-3',
  'chart-warm-4',
  'chart-warm-5',
  'chart-warm-6',
] as const satisfies readonly ThemeToken[]
/**
 * The breakdown's seven-step ramp (#866). It is not in `CHART_PAIRS` on purpose: its steps run
 * from orange to near-white, so the pale ones are under 3:1 on a light page. Every ramp mark
 * therefore carries a thin outline (`chart-ramp-edge`) and its amount as text, never colour alone.
 */
export const CHART_RAMP_TOKENS = [
  'chart-ramp-1',
  'chart-ramp-2',
  'chart-ramp-3',
  'chart-ramp-4',
  'chart-ramp-5',
  'chart-ramp-6',
  'chart-ramp-7',
] as const satisfies readonly ThemeToken[]
export const CHART_PAIRS = [...CHART_TOKENS, ...CHART_WARM_TOKENS].flatMap((chart) =>
  (['background', 'surface', 'card'] as const).map((background) => [chart, background] as const),
)

/**
 * Text on a tint of a colour over a background, as `Alert` draws its tones (`bg-<tint>/10`):
 * [text, tint, background, alpha]. The test paints the tint at that opacity over the
 * background, as the browser does, then checks the text against the result.
 */
export const TINT_ALPHA = 0.1
const ALERT_TONES = [
  // `Card · tinted` (`bg-primary/10`): the sidebar box's text (#216)
  ['foreground', 'primary'],
  ['primary-strong', 'primary'],
  ['warning-strong', 'warning'],
  ['info-strong', 'info'],
  ['success-strong', 'success'],
  ['done-strong', 'done'],
  ['destructive-strong', 'destructive'],
  // An outcome fork's "stop" card: its body text on the destructive tint (#510)
  ['foreground', 'destructive'],
] as const satisfies readonly (readonly [ThemeToken, ThemeToken])[]
export const TINTED_PAIRS = ALERT_TONES.flatMap(([text, tint]) =>
  (['background', 'surface', 'card'] as const).map(
    (background) => [text, tint, background, TINT_ALPHA] as const,
  ),
)

/**
 * A badge on a photo (`Badge · on-image`, `bg-scrim/60`): its text on the scrim at
 * `ON_IMAGE_SCRIM_ALPHA` over the brightest a photo can be, white, which `--on-image` stands for.
 */
export const ON_IMAGE_SCRIM_ALPHA = 0.6
/**
 * The title on a post or event photo (`PageHeader · image`): the lightest part of its scrim, the top
 * of the band (`to-scrim/55`), over a white photo. Lower it only if the pair below still passes.
 */
export const ON_IMAGE_TITLE_SCRIM_ALPHA = 0.55
export const SCRIM_PAIRS = [
  ['on-image', 'scrim', 'on-image', ON_IMAGE_SCRIM_ALPHA],
  ['on-image', 'scrim', 'on-image', ON_IMAGE_TITLE_SCRIM_ALPHA],
] as const

/**
 * The darkening layer under `GlassPanel`'s glass (`bg-scrim/80`), so its `on-image` text passes
 * wherever the panel sits. 0.8 is the lowest round value that holds: over a white photo the text
 * (at 90%, as the hero sets it) on the layer, the glass tint (`GLASS_TINT_ALPHA`) and the sheen at
 * its strongest (`GLASS_SHEEN_ALPHA`) measures 5.2:1 or better, while 0.7 falls to 4.0:1.
 * `GlassPanel` writes the same numbers as its classes, which its test checks, in both modes.
 */
export const GLASS_SCRIM_ALPHA = 0.8
/** The glass's white tint (`bg-on-image/10`) and the strongest part of its sheen (`from-on-image/15`) */
export const GLASS_TINT_ALPHA = 0.1
export const GLASS_SHEEN_ALPHA = 0.15

/**
 * The theme's own background colour laid over a page's backdrop photo (`PageBackdrop`, #1268), as
 * a share of its strength, light and dark. It is faint on purpose: it only evens the photo out,
 * where there is no text, so the photo is plainly visible there. Text never relies on it: each
 * block of text sits on a solid plate (`text-plate`) or fade (`text-fade`) in the page colour, and
 * the title on the glow (`text-shadow-glow`), all from `tailwind.css`. `PageBackdrop` writes these
 * numbers as its classes (`bg-background/8 dark:bg-background/14`), which its test checks. The same
 * numbers for every photo: the scrim is never adjusted per photo (images guideline, rule 14).
 */
export const BACKDROP_SCRIM_ALPHA = { light: 0.08, dark: 0.14 } as const

/**
 * The page-colour tint of a title band over a page's photo (`PageHeader · band`, `on-photo:bg-background/26`),
 * so the band reads as a soft veil, not a hole. It carries no contrast: the title sits on its own
 * plate. `PageHeader` writes the same number as its class, which its test checks.
 */
export const BACKDROP_BAND_TINT_ALPHA = 0.26

/** WCAG 2.x AA minimum for normal text. */
export const MIN_TEXT_CONTRAST = 4.5
