import type { ReactNode } from 'react'

/**
 * The format of a component's examples (#1532, docs/ui/component-set.md "Showcase examples"): the
 * `*.examples.tsx` file beside a component exports one `defineExample(…)` for each configuration
 * worth showing. The showcase draws them, the tests render each one and run axe on it, and the
 * generated showcase index (`docs/reference/showcase-index.json`) lists them. An example is plain
 * data and a pure `render` function: no hooks, no CMS, no secret, no network.
 */

type SettingBase = { description?: string }
/** A switch the visitor of the showcase may flip */
type BooleanSetting = SettingBase & { kind: 'boolean'; default: boolean }
/** One of a short list of words */
type ChoiceSetting = SettingBase & {
  kind: 'choice'
  options: readonly string[]
  default: string
}
/** Words the visitor may type */
type TextSetting = SettingBase & { kind: 'text'; default: string }

export type ExampleSetting = BooleanSetting | ChoiceSetting | TextSetting
export type ExampleSettings = Record<string, ExampleSetting>

/** What `render` receives: each setting's value, of the type its kind gives */
export type SettingValues<S extends ExampleSettings> = {
  [K in keyof S]: S[K] extends { kind: 'boolean' }
    ? boolean
    : S[K] extends { kind: 'choice'; options: readonly (infer O)[] }
      ? O
      : string
}

export type Example<S extends ExampleSettings = ExampleSettings> = {
  /** One line saying what this configuration is for; shown beside it */
  purpose: string
  /**
   * The components it shows, when not just the one named like the file: for the others in the
   * file (`Card`'s `CardBody`) or a second component drawn by the same file
   */
  of?: string | readonly string[]
  /** What a visitor may change, each with the value the example starts at */
  settings?: S
  /** The configuration itself: a pure function of the settings, drawn by a server or client page */
  render: (values: SettingValues<S>) => ReactNode
}

/** Gives an example its types: the settings' kinds decide the type of each value `render` gets. */
export function defineExample<const S extends ExampleSettings = Record<never, never>>(
  example: Example<S>,
): Example<S> {
  return example
}

/** Each setting at its default: what the page draws before the visitor changes anything. */
export function defaultSettings<S extends ExampleSettings>(settings: S | undefined) {
  return Object.fromEntries(
    Object.entries(settings ?? {}).map(([key, setting]) => [key, setting.default]),
  ) as SettingValues<S>
}

/** A row of examples that wraps on a narrow screen: one definition, so every examples file lines up. */
export const EXAMPLE_ROW = 'flex flex-wrap items-center gap-3'
