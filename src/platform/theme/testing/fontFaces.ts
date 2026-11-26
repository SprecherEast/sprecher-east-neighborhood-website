import { readFileSync } from 'node:fs'
import path from 'node:path'

/**
 * Reads the site's font definition (`fonts.ts`) as text, for the tests that keep the other places that
 * name the same faces equal to it (`fonts.test.ts`, `.storybook/fonts.test.ts`, the developer-site
 * check). `next/font` only runs inside Next's build, so the source is the one list they can read. Each
 * object is read by its keys, in any order, and one that lacks a key or is not read at all throws, so an
 * extra or malformed face cannot pass for a listed one.
 */
export type FontFace = { file: string; weight: string; style: string }
export type FontCall = {
  variable: string
  preload: boolean
  range: string
  faces: FontFace[]
}

const SOURCE = path.join(__dirname, '../fonts.ts')

const key = (text: string, name: string) => text.match(new RegExp(`\\b${name}:\\s*'([^']*)'`))?.[1]

export function siteFontCalls(source = readFileSync(SOURCE, 'utf8')): FontCall[] {
  return source
    .split('localFont(')
    .slice(1)
    .map((call) => {
      const list = call.match(/src:\s*\[([\s\S]*?)\n\s*\],/)?.[1] ?? ''
      const objects = list.match(/\{[^{}]*\}/g) ?? []
      const faces = objects.map((object) => {
        const file = key(object, 'path')
        const weight = key(object, 'weight')
        const style = key(object, 'style')
        if (!file || !weight || !style) throw new Error(`a font face is missing a key: ${object}`)
        return { file: file.replace('./fonts/', ''), weight, style }
      })
      if ((list.match(/\bpath:/g) ?? []).length !== faces.length)
        throw new Error('a font face was not read')
      const declarations = call.match(/declarations:\s*\[([\s\S]*?)\]/)?.[1] ?? ''
      return {
        variable: call.match(/variable:\s*'([^']+)'/)?.[1] ?? '',
        preload: !/preload:\s*false/.test(call),
        range: declarations.includes("'unicode-range'") ? (key(declarations, 'value') ?? '') : '',
        faces,
      }
    })
}
