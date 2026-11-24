import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import { listFiles } from './listFiles.mjs'

describe('listFiles', () => {
  it('lists every file under a folder, with its path inside it, sorted', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sena1461-list-'))
    const write = (file) => {
      fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true })
      fs.writeFileSync(path.join(root, file), '')
    }
    write('b.txt')
    write('a-b/x.txt')
    write('a/z.txt')
    write('a/deep/y.txt')
    fs.mkdirSync(path.join(root, 'empty'))
    const found = listFiles(root)
    fs.rmSync(root, { recursive: true, force: true })
    // sorted as whole paths, so `a-b/…` comes before `a/…` ('-' sorts before '/')
    expect(found).toEqual(['a-b/x.txt', 'a/deep/y.txt', 'a/z.txt', 'b.txt'])
  })

  it('names a folder that is required and missing, so a renamed route folder is not an empty section', () => {
    expect(() => listFiles('/nonexistent-sena1461-folder', { required: true })).toThrow(
      '/nonexistent-sena1461-folder does not exist',
    )
  })

  it('lists nothing for a folder that does not exist', () => {
    expect(listFiles('/nonexistent-sena1461-folder')).toEqual([])
  })
})

describe('the folders the pages are built from (#1461)', () => {
  it('stop with an error when a route folder or `src/app` is missing', async () => {
    const { collectRoutes } = await import('./routes.mjs')
    const { collectAppFiles } = await import('./metadataRoutes.mjs')
    expect(() => collectRoutes('/nonexistent-sena1461-root')).toThrow('does not exist')
    expect(() => collectAppFiles('/nonexistent-sena1461-root')).toThrow('does not exist')
  })
})
