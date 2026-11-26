import { describe, expect, it } from 'vitest'

import { editorUrl, githubUrl, issueSearchUrl, safeIssueUrl } from './links.mjs'

const repo = { owner: 'Owner', name: 'repo' }

describe('links (#1463)', () => {
  it('opens a file on GitHub, and a folder as a tree', () => {
    expect(githubUrl(repo, 'src/modules/events/README.md')).toBe(
      'https://github.com/Owner/repo/blob/main/src/modules/events/README.md',
    )
    expect(githubUrl(repo, 'src/modules/events')).toBe(
      'https://github.com/Owner/repo/tree/main/src/modules/events',
    )
  })

  it('encodes the brackets of route folders and leaves parentheses', () => {
    expect(githubUrl(repo, 'src/app/(frontend)/auth/[provider]/route.ts')).toBe(
      'https://github.com/Owner/repo/blob/main/src/app/(frontend)/auth/%5Bprovider%5D/route.ts',
    )
  })

  it('gives no link for a path that climbs out, is absolute or has odd characters', () => {
    for (const bad of [
      '../etc/passwd',
      '/etc/passwd',
      'a/../b',
      'a\\b',
      'a?b=c',
      'javascript:alert(1)',
      '',
      null,
      'a//b',
    ]) {
      expect(githubUrl(repo, bad)).toBeNull()
      expect(editorUrl('/home/me/repo', bad)).toBeNull()
    }
  })

  it('opens a file in the editor from the checkout folder given once', () => {
    expect(editorUrl('/home/me/my repo/', 'src/a.ts')).toBe(
      'vscode://file/home/me/my%20repo/src/a.ts',
    )
    expect(editorUrl('C:\\work\\repo', 'src/a.ts')).toBe('vscode://file/C:/work/repo/src/a.ts')
    expect(editorUrl('', 'src/a.ts')).toBeNull()
    expect(editorUrl('/x"y', 'src/a.ts')).toBeNull()
  })

  it('searches the open issues for a path', () => {
    expect(issueSearchUrl(repo, 'src/a.ts')).toBe(
      'https://github.com/Owner/repo/issues?q=is%3Aissue%20is%3Aopen%20src%2Fa.ts',
    )
  })

  it('follows only GitHub issue links', () => {
    expect(safeIssueUrl('https://github.com/Owner/repo/issues/12')).toBe(
      'https://github.com/Owner/repo/issues/12',
    )
    expect(safeIssueUrl('https://evil.example/issues/1')).toBeNull()
    expect(safeIssueUrl('javascript:alert(1)')).toBeNull()
  })
})
