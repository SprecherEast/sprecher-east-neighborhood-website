import { describe, expect, it } from 'vitest'

import { filingCheck, filingRequests, SESSION_REMINDER } from './filing.mjs'

const policy = {
  types: ['bug', 'enhancement', 'documentation', 'tech-debt', 'process'],
  areas: ['frontend', 'ci', 'tooling'],
}

const GOOD_BODY = `### Problem

Sessions can file an issue that skips what the issue form asks for.

### Existing work compared

Searched the open and closed issues for the same goal; none covers it, the closest only reports it.

### Acceptance criteria

- [ ] A filing without a section is refused.

### Files likely touched

\`.claude/hooks/\`

### Must not touch

None
`

const files = (map) => (file) => {
  if (!(file in map)) throw new Error('no such file')
  return map[file]
}
const check = (command, map = {}) => filingCheck(command, { policy, readFile: files(map) })

const LABELS = `-f 'labels[]=process' -f 'labels[]=ci' -f 'labels[]=priority: high' -F milestone=10`

describe('filingRequests', () => {
  it('finds an issue created through the API and reads its fields', () => {
    const [request] = filingRequests(
      `gh api -X POST repos/{owner}/{repo}/issues -f title=T -f body=B ${LABELS}`,
    )
    expect(request).toMatchObject({
      title: 'T',
      body: 'B',
      labels: ['process', 'ci', 'priority: high'],
      milestone: '10',
    })
  })

  it('treats gh api with fields and no method as a POST, and ignores a GET', () => {
    expect(filingRequests('gh api repos/o/r/issues -f title=T')).toHaveLength(1)
    expect(filingRequests('gh api -X GET repos/o/r/issues -f state=open')).toEqual([])
    expect(filingRequests('gh api repos/o/r/issues --jq .[].number')).toEqual([])
  })

  it('leaves every other call alone: labels, comments, links, fields, sub-issues', () => {
    for (const command of [
      'gh api -X POST repos/o/r/issues/12/labels -f labels[]=ready',
      'gh api -X POST repos/o/r/issues/12/comments -f body=hi',
      'gh api -X POST repos/o/r/issues/919/sub_issues -F sub_issue_id=5',
      'gh api -X POST repos/o/r/issues/12/issue-field-values --input -',
      'gh api -X POST repos/o/r/issues/12/assignees -f assignees[]=a',
      'gh issue view 5',
      'gh issue comment 5 --body hi',
      'gh issue edit 5 --add-label ready',
    ])
      expect(filingRequests(command), command).toEqual([])
  })

  it('reads gh issue create: title, body, repeated and comma-separated labels, milestone', () => {
    const [request] = filingRequests(
      `gh issue create -t T -b B -l process,ci --label 'priority: high' -m Backlog`,
    )
    expect(request).toMatchObject({
      title: 'T',
      body: 'B',
      labels: ['process', 'ci', 'priority: high'],
      milestone: 'Backlog',
    })
  })

  it('finds the request in a longer command line', () => {
    expect(filingRequests('cd x && gh api repos/o/r/issues -f title=T; echo done')).toHaveLength(1)
  })
})

describe('filingCheck', () => {
  const create = (extra = '') =>
    `gh api repos/{owner}/{repo}/issues -f title=T -F body=@/tmp/b.md ${LABELS} ${extra}`

  it('allows a complete issue, reading the body from a file', () => {
    expect(check(create(), { '/tmp/b.md': GOOD_BODY })).toBeNull()
  })

  it('allows a complete issue given inline', () => {
    const inline = `gh issue create -t T -b '${GOOD_BODY}' -l process,ci,'priority: high' -m 10`
    expect(check(inline)).toBeNull()
  })

  it('reads a JSON body passed with --input <file>', () => {
    const json = JSON.stringify({
      title: 'T',
      body: GOOD_BODY,
      labels: ['process', 'ci', 'priority: high'],
      milestone: 10,
    })
    expect(check('gh api repos/o/r/issues --input /tmp/i.json', { '/tmp/i.json': json })).toBeNull()
  })

  it('names each failing rule with its fix', () => {
    const body = GOOD_BODY.replace(/### Acceptance criteria[\s\S]*?(?=###)/, '')
    const reason = check(create(), { '/tmp/b.md': body })
    expect(reason).toContain('ISSUE-CRITERIA')
    expect(reason).toContain('filing-checklist.md')
  })

  it('refuses a filing without the duplicate-search record', () => {
    const body = GOOD_BODY.replace(/### Existing work compared[\s\S]*?(?=###)/, '')
    expect(check(create(), { '/tmp/b.md': body })).toContain('ISSUE-DUPLICATES')
  })

  it('refuses missing labels and milestone', () => {
    const reason = check('gh api repos/o/r/issues -f title=T -F body=@/tmp/b.md', {
      '/tmp/b.md': GOOD_BODY,
    })
    for (const id of ['ISSUE-TYPE', 'ISSUE-AREA', 'ISSUE-PRIORITY', 'ISSUE-MILESTONE'])
      expect(reason).toContain(id)
  })

  it('refuses a body it cannot read, saying how to pass one', () => {
    expect(check(create(), {})).toContain('-F body=@')
    expect(check('gh api repos/o/r/issues --input -')).toContain('--input <absolute file>')
  })

  it('does not touch commands that are not filings', () => {
    expect(check('gh api -X POST repos/o/r/issues/1/labels -f labels[]=ready')).toBeNull()
    expect(check('git commit -m "gh api repos/o/r/issues"')).toBeNull()
  })

  it('lets an epic through without the issue sections', () => {
    const epic = `gh api repos/o/r/issues -f title=T -f body=Epic -f 'labels[]=epic' -F milestone=1`
    expect(check(epic)).toBeNull()
  })
})

describe('filingCheck: forms a complete filing can take', () => {
  const ok = { '/tmp/b.md': GOOD_BODY }
  const flags = `-f 'labels[]=process' -f 'labels[]=ci' -f 'labels[]=priority: high'`

  it('reads --flag=value and attached short-flag values', () => {
    expect(
      check(
        `gh issue create --title=T --body-file=/tmp/b.md --label=process,ci --label='priority: high' --milestone=Backlog`,
        ok,
      ),
    ).toBeNull()
    expect(
      check(`gh api repos/o/r/issues -ftitle=T -F body=@/tmp/b.md ${flags} -Fmilestone=1`, ok),
    ).toBeNull()
    expect(
      check('gh api repos/o/r/issues --input=/tmp/i.json', {
        '/tmp/i.json': JSON.stringify({
          body: GOOD_BODY,
          labels: ['process', 'ci', 'priority: high'],
          milestone: 1,
        }),
      }),
    ).toBeNull()
  })

  it('does not take a read for a filing, however the method is written', () => {
    for (const method of ['-X GET', '-XGET', '--method=GET', '--method GET'])
      expect(check(`gh api ${method} repos/o/r/issues -f state=all`), method).toBeNull()
  })

  it('sees a full URL, a query string, a variable prefix, env and a path to gh', () => {
    for (const prefix of ['', 'GH_REPO=o/r ', 'env ', 'command ', '/usr/bin/'])
      expect(
        check(`${prefix}gh api https://api.github.com/repos/o/r/issues -f title=T`),
        prefix,
      ).toContain('ISSUE-')
    expect(check('gh api "repos/o/r/issues?x=1" -f title=T')).toContain('ISSUE-')
  })

  it('refuses a body that is a shell expansion or a path with one, saying how to pass it', () => {
    for (const command of [
      'gh issue create -b "$(cat /tmp/b.md)" -t T',
      'gh api repos/o/r/issues -f body="$(cat /tmp/b.md)"',
      'gh api repos/o/r/issues -F body=@$F',
      'gh api repos/o/r/issues -F body=@~/b.md',
    ])
      expect(check(command, ok), command).toContain('absolute file')
  })

  it('lets the browser and editor forms through, and names standard input for -F -', () => {
    expect(check('gh issue create --web')).toBeNull()
    expect(check('gh issue create -e -t T')).toBeNull()
    expect(check('gh issue create -F -')).toContain('standard input')
    expect(check('gh api repos/o/r/issues -F body=@-')).toContain('standard input')
  })

  it('tells gh issue create to use --body-file, and gh api -F body=@', () => {
    expect(check('gh issue create --body-file -')).toContain('--body-file <absolute file>')
    expect(check('gh api repos/o/r/issues --input -')).toContain('--input <absolute file>')
  })
})

describe('SESSION_REMINDER', () => {
  it('names the filing checklist, the duplicate search, claiming by assigning and the card history', () => {
    expect(SESSION_REMINDER).toContain('docs/process/filing-checklist.md')
    expect(SESSION_REMINDER).toMatch(/duplicate/i)
    expect(SESSION_REMINDER).toMatch(/assign/i)
    expect(SESSION_REMINDER).toContain('card-history')
  })

  it('stays short, since every session carries it', () => {
    expect(SESSION_REMINDER.length).toBeLessThan(900)
  })
})
