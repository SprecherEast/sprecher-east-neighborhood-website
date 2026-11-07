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
  destructive: { modes: 'both', meaning: 'Errors and destructive actions' },
  'destructive-foreground': { modes: 'both', meaning: 'Destructive text (shadcn name)' },
  'destructive-strong': { modes: 'both', meaning: 'Error text that passes on panels' },
  surface: { modes: 'both', meaning: 'Raised panels and alternating sections' },
  border: { modes: 'both', meaning: 'Dividers and card borders' },
  input: { modes: 'both', meaning: 'Form control borders (3:1, WCAG 1.4.11)' },
  ring: { modes: 'both', meaning: 'Focus ring' },
  success: { modes: 'both', meaning: 'Success state' },
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
  radius: { modes: 'base', meaning: 'Base corner radius; sm to xl derive from it' },
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
  ['primary-strong', 'background'],
  ['primary-strong', 'surface'],
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
export const CHART_PAIRS = CHART_TOKENS.flatMap((chart) =>
  (['background', 'surface', 'card'] as const).map((background) => [chart, background] as const),
)

/**
 * Text on a tint of a colour over a background, as `Alert` draws its tones (`bg-<tint>/10`):
 * [text, tint, background, alpha]. The test paints the tint at that opacity over the
 * background, as the browser does, then checks the text against the result.
 */
export const TINT_ALPHA = 0.1
const ALERT_TONES = [
  ['foreground', 'muted-foreground'],
  // `Card · tinted` (`bg-primary/10`): the sidebar box's text (#216)
  ['foreground', 'primary'],
  ['primary-strong', 'primary'],
  ['warning-strong', 'warning'],
  ['info-strong', 'info'],
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

/** WCAG 2.x AA minimum for normal text. */
export const MIN_TEXT_CONTRAST = 4.5
