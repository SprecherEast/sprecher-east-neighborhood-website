/**
 * Reads a theme file (`src/themes/<name>/theme.css`) for the contract test (#146). A theme sets
 * its tokens in two blocks: light (`:root, [data-theme='light']`) and dark
 * (`[data-theme='dark']`). Dark inherits what it leaves out, as the browser does.
 */

type TokenValues = Record<string, string>

export interface ThemeModes {
  light: TokenValues
  /** Light values overridden by dark's: what the browser uses in dark mode. */
  dark: TokenValues
  /** Only what the dark block sets itself. */
  darkOwn: TokenValues
}

const LIGHT_BLOCK = /:root\s*,\s*\[data-theme='light'\]\s*\{([^}]*)\}/
const DARK_BLOCK = /(?:^|\n)\[data-theme='dark'\]\s*\{([^}]*)\}/

const COMMENT = /\/\*[\s\S]*?\*\//g

function readDeclarations(body: string): TokenValues {
  const values: TokenValues = {}
  for (const [, name, value] of body.matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)) {
    values[name] = value.trim()
  }
  return values
}

export function readThemeModes(css: string): ThemeModes {
  // Comments first: a commented-out block is ignored by the browser, so it must not count
  const stylesheet = css.replace(COMMENT, '')
  const light = LIGHT_BLOCK.exec(stylesheet)
  const dark = DARK_BLOCK.exec(stylesheet)
  if (!light) throw new Error("The theme has no light block (:root, [data-theme='light'])")
  if (!dark) throw new Error("The theme has no dark block ([data-theme='dark'])")
  const lightValues = readDeclarations(light[1])
  const darkOwn = readDeclarations(dark[1])
  return { light: lightValues, dark: { ...lightValues, ...darkOwn }, darkOwn }
}

type Rgb = [number, number, number]

function hexToRgb(hex: string): Rgb {
  const match = /^#([0-9a-f]{6})$/i.exec(hex)
  if (!match) throw new Error(`Contrast needs a 6-digit hex colour, got "${hex}"`)
  return [0, 2, 4].map((i) => parseInt(match[1].slice(i, i + 2), 16) / 255) as Rgb
}

const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)

function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map(toLinear)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/**
 * `color` at `alpha` opacity painted over `background`, as a 6-digit hex colour. Tailwind's
 * `bg-x/10` is `color-mix(in oklab, x 10%, transparent)`: `x` at 10% opacity, which the browser
 * then composites over the page per sRGB channel. So the blend here is plain sRGB.
 */
export function mixOver(color: string, background: string, alpha: number): string {
  const top = hexToRgb(color)
  const mixed = hexToRgb(background).map((c, i) => c + (top[i] - c) * alpha)
  return `#${mixed
    .map((c) =>
      Math.round(c * 255)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`
}

/** WCAG 2.x contrast ratio between two 6-digit hex colours. */
export function contrastRatio(a: string, b: string): number {
  const [darker, lighter] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => x - y)
  return (lighter + 0.05) / (darker + 0.05)
}
