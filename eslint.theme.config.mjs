// Components use theme tokens only (decisions 0006 and 0012, #146): a raw Tailwind palette colour
// (`text-white`, `bg-blue-500`) or a hex/rgb colour in a class ignores the theme, so a seasonal
// theme or dark mode can't change it. Use a token class instead: `text-on-image` and `bg-scrim`
// on photos, `text-primary-foreground` on brand bands, `bg-inverse` for dark chrome
// (src/platform/theme/tokens.ts lists them all).

const PALETTE =
  '\\b(bg|text|border(?:-[trblxyse])?|from|via|to|ring(?:-offset)?|fill|stroke|outline|decoration|divide|shadow|inset-shadow|drop-shadow|placeholder|caret|accent)-(white|black|slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)(-\\d+)?\\b'
const COLOUR_VALUE = '#[0-9a-fA-F]{3,8}\\b|\\brgba?\\(|\\bhsla?\\('
// A colour inside a Tailwind arbitrary value (`shadow-[0_0_4px_#000]`), in any string: cva(), cn()
const ARBITRARY_COLOUR = '\\[[^\\]]*(#[0-9a-fA-F]{3,8}\\b|rgba?\\(|hsla?\\()'

const message = (what) =>
  `${what} ignores the theme: use a token class (src/platform/theme/tokens.ts, decision 0012)`

export const themeTokensConfig = {
  files: ['src/**/*.{ts,tsx}'],
  ignores: [
    'src/**/*.test.{ts,tsx}',
    'src/payload-types.ts',
    'src/migrations/**',
    'src/app/(payload)/**',
  ],
  rules: {
    'no-restricted-syntax': [
      'error',
      { selector: `Literal[value=/${PALETTE}/]`, message: message('A Tailwind palette colour') },
      {
        selector: `TemplateElement[value.raw=/${PALETTE}/]`,
        message: message('A Tailwind palette colour'),
      },
      {
        selector: `Literal[value=/${ARBITRARY_COLOUR}/]`,
        message: message('A colour value in a class'),
      },
      {
        selector: `TemplateElement[value.raw=/${ARBITRARY_COLOUR}/]`,
        message: message('A colour value in a class'),
      },
      {
        selector: `JSXAttribute[name.name='className'] Literal[value=/${COLOUR_VALUE}/]`,
        message: message('A colour value in a class'),
      },
      {
        selector: `JSXAttribute[name.name='className'] TemplateElement[value.raw=/${COLOUR_VALUE}/]`,
        message: message('A colour value in a class'),
      },
    ],
  },
}
