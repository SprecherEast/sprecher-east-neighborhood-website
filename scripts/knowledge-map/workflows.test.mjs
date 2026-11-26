import { describe, expect, it } from 'vitest'

import { buildWorkflows } from './workflows.mjs'

const lint = `name: Lint
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  schedule:
    - cron: '0 6 * * *'
jobs:
  prettier:
    name: Prettier
    runs-on: ubuntu-latest
    steps:
      - run: npx prettier --check .
      - run: npm run agent-context
  eslint:
    runs-on: ubuntu-latest
    steps:
      - run: npx eslint .
`
const sweep = `name: Sweep
on:
  workflow_dispatch:
jobs:
  sweep:
    name: Sweep previews
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
`

describe('buildWorkflows', () => {
  const { nodes, edges } = buildWorkflows({
    workflows: [
      { path: '.github/workflows/lint.yml', text: lint },
      { path: '.github/workflows/sweep.yml', text: sweep },
    ],
    siteId: 'site:sprecher-east',
    groupId: 'group:ci',
  })
  const byId = (id) => nodes.find((n) => n.id === id)
  const edge = (from, to, type) =>
    edges.find((e) => e.from === from && e.to === to && e.type === type)

  it('makes a node of each workflow, named from the file, with what starts it', () => {
    expect(byId('ci-workflow:lint')).toMatchObject({
      type: 'ci-workflow',
      name: 'Lint',
      path: '.github/workflows/lint.yml',
    })
    expect(byId('ci-workflow:lint').facts).toContainEqual({
      label: 'Starts on',
      value: 'push (main), pull request (main), schedule 0 6 * * *',
    })
    expect(byId('ci-workflow:sweep').facts).toContainEqual({
      label: 'Starts on',
      value: 'manual run',
    })
  })

  it('makes a check of each job, named by its name or key, with the commands it runs', () => {
    expect(byId('check:lint#prettier')).toMatchObject({
      type: 'check',
      name: 'Prettier',
      path: '.github/workflows/lint.yml',
    })
    expect(byId('check:lint#prettier').facts).toContainEqual({
      label: 'Runs',
      value: 'npx prettier --check .; npm run agent-context',
    })
    expect(byId('check:lint#eslint').name).toBe('eslint')
  })

  it('has a workflow call the reusable workflow a job uses', () => {
    const { edges: found } = buildWorkflows({
      workflows: [
        {
          path: '.github/workflows/ci.yml',
          text: 'name: CI\non: push\njobs:\n  deploy:\n    uses: ./.github/workflows/deploy.yml\n',
        },
      ],
      groupId: 'group:ci',
    })
    expect(found).toContainEqual({
      from: 'ci-workflow:ci',
      to: 'path:.github/workflows/deploy.yml',
      type: 'calls',
      count: 1,
      via: ['deploy'],
    })
  })

  it('holds a workflow in its group and a check in its workflow', () => {
    expect(edge('group:ci', 'ci-workflow:lint', 'contains')).toBeDefined()
    expect(edge('ci-workflow:lint', 'check:lint#prettier', 'contains')).toBeDefined()
  })

  it('leaves out a step that uses an action, which runs no command of ours', () => {
    expect(byId('check:sweep#sweep').facts.find((f) => f.label === 'Runs')).toBeUndefined()
  })

  it('refuses a workflow that is not valid YAML, naming the file', () => {
    expect(() =>
      buildWorkflows({
        workflows: [{ path: '.github/workflows/x.yml', text: 'a: [' }],
        siteId: 's',
        groupId: 'g',
      }),
    ).toThrow(/x\.yml/)
  })
})
