/**
 * The whole page each renderer writes, for a small stand-in config, compared with the text kept
 * in `__snapshots__/` (#1461). A change to any label, separator, order or cell helper shows up as
 * a changed line, which a test of single values would not see. Read the snapshot when it changes.
 */
import { describe, expect, it } from 'vitest'

import { describeApi } from './endpoints.mjs'
import { base, locate as apiLocate } from './endpointsFixture.mjs'
import { renderApi } from './endpointsPage.mjs'
import { describeJobs } from './jobs.mjs'
import { renderJobs } from './jobsPage.mjs'
import { describeMcp, renderMcp } from './mcpTools.mjs'
import {
  jobsConfig,
  jobsExtras,
  jobsReach,
  jobsWorkflows,
  locate,
  mcpAccess,
  mcpCalls,
  mcpOptions,
  moreApi,
  mcpSchema,
} from './pagesFixture.mjs'

const snapshot = (name) => `./__snapshots__/${name}.txt`

describe('whole pages', () => {
  it('writes the endpoints page', async () => {
    const page = renderApi(describeApi(moreApi(base), apiLocate))
    await expect(page).toMatchFileSnapshot(snapshot('endpoints'))
  })

  it('writes the jobs page', async () => {
    const jobs = describeJobs(jobsConfig, locate, jobsReach, {
      endpoints: [
        { method: 'GET', path: '/api/payload-jobs/run', guards: 'run' },
        { method: 'GET', path: '/api/payload-jobs/handle-schedules', guards: 'run' },
      ],
    })
    await expect(renderJobs(jobs, jobsWorkflows, jobsExtras)).toMatchFileSnapshot(snapshot('jobs'))
  })

  it('writes the AI agent tools page', async () => {
    const mcp = describeMcp(mcpOptions, {
      locate,
      access: mcpAccess,
      schemaOf: mcpSchema,
      calls: mcpCalls,
    })
    await expect(renderMcp(mcp)).toMatchFileSnapshot(snapshot('mcp-tools'))
  })
})
