/** Replaces each `{name}` in a whole sentence with its value; a missing value is a bug. */
export function fillBlanks(sentence: string, values: Readonly<Record<string, string>>): string {
  return sentence.replace(/\{(\w+)\}/g, (_, name: string) => {
    const value = values[name]
    if (value === undefined) throw new Error(`Message is missing a value for {${name}}`)
    return value
  })
}
