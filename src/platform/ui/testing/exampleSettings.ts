import { defaultSettings, type ExampleSetting } from '../example'

/** Each way a visitor could change one setting from its default, the others left alone. */
export function settingVariations(settings: Record<string, ExampleSetting> | undefined) {
  const start = defaultSettings(settings ?? {}) as Record<string, unknown>
  return Object.entries(settings ?? {}).flatMap(([key, setting]) => {
    const others =
      setting.kind === 'boolean'
        ? [!setting.default]
        : setting.kind === 'choice'
          ? setting.options.filter((option) => option !== setting.default)
          : [`${setting.default} again`]
    return others.map((value) => ({ ...start, [key]: value }))
  })
}
