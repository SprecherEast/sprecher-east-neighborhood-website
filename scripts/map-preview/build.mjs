#!/usr/bin/env node
/**
 * Draws public/images/sprecher-east-map.png (the About page map picture) from the data snapshot.
 *   node scripts/map-preview/build.mjs          writes the PNG
 *   node scripts/map-preview/build.mjs --svg    also writes the SVG next to it, for a look
 * The picture is rebuilt, never edited by hand. Sources and dates: scripts/map-preview/README.md.
 */
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

import sharp from 'sharp'

import { buildSvg } from './render.mjs'

const here = new URL('.', import.meta.url)
const data = JSON.parse(await readFile(new URL('data/madison-map.json', here), 'utf8'))
const svg = buildSvg(data)
const out = fileURLToPath(new URL('../../public/images/sprecher-east-map.png', here))

await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(out)
if (process.argv.includes('--svg')) await writeFile(out.replace(/\.png$/, '.svg'), svg)
console.log(`Wrote ${out}`)
