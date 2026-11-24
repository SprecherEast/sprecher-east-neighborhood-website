import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'

// The site's CMS over MCP (#336): the find tools, submitSuggestion, reportItem and the agent's own
// run log, with the agent account's API key. Only this code holds the key; no model sees it.

/** The JSON documents in a find tool's answer: one per line after the heading. */
export const docsIn = (text) =>
  String(text ?? '')
    .split('\n')
    .filter((line) => line.startsWith('{'))
    .map((line) => JSON.parse(line))

/** Errors whose cause is likely to pass on a retry: no answer, a 5xx, a 429. */
export const isTransient = (error) =>
  /timeout|timed out|ECONN|ENOTFOUND|EAI_AGAIN|fetch failed|5\d\d|429|Too many/i.test(
    String(error?.message ?? error),
  )

/** Turns a raw tool caller into the operations the pipeline needs. */
export function cmsOperations(callTool) {
  const call = async (name, args) => {
    const { text, isError } = await callTool(name, args)
    if (isError) throw new Error(`${name}: ${String(text).slice(0, 300)}`)
    return text
  }
  return {
    /** Every category, for the draft stage's `taxonomy` (slug, title, parent slug). */
    async taxonomy() {
      const docs = []
      for (let page = 1; page <= 5; page++) {
        const text = await call('findCategories', { limit: 100, page, depth: 0 })
        const found = docsIn(text)
        docs.push(...found)
        if (found.length < 100) break
      }
      const slugById = new Map(docs.map((d) => [d.id, d.slug]))
      return docs
        .filter((d) => typeof d.slug === 'string')
        .map((d) => ({
          slug: d.slug,
          title: d.title ?? d.slug,
          parent: slugById.get(d.parent) ?? null,
        }))
    },
    /** The published document stored with this externalId, for the item's `known` section. */
    async known(externalId) {
      for (const [collection, tool] of [
        ['events', 'findEvents'],
        ['posts', 'findPosts'],
      ]) {
        const where = JSON.stringify({ externalId: { equals: externalId } })
        const [doc] = docsIn(await call(tool, { where, limit: 1, depth: 0 }))
        if (doc) {
          return {
            collection,
            id: doc.id,
            externalId,
            contentHash: doc.contentHash,
            status: doc.cancelled ? 'cancelled' : 'active',
          }
        }
      }
      return null
    },
    async createRun(run) {
      const [doc] = docsIn(await call('createAgentRuns', run))
      return doc?.id
    },
    updateRun: (id, fields) => call('updateAgentRuns', { id, ...fields }),
    submitSuggestion: async (args) => JSON.parse(await call('submitSuggestion', args)),
    reportItem: (args) => call('reportItem', args),
  }
}

/** A connected MCP client for `url` with `apiKey`. Close it with `close()`. */
export async function connectCms({ url, apiKey }) {
  const client = new Client({ name: 'sprecher-east-intelligence-runner', version: '1.0.0' })
  const transport = new StreamableHTTPClientTransport(new URL(url), {
    requestInit: { headers: { Authorization: `Bearer ${apiKey}` } },
  })
  await client.connect(transport)
  const callTool = async (name, args) => {
    const result = await client.callTool({ name, arguments: args })
    return { text: result.content?.[0]?.text ?? '', isError: Boolean(result.isError) }
  }
  return { ...cmsOperations(callTool), close: () => client.close() }
}

/**
 * For `--dry-run`: reads through a real CMS when one is given (the find tools only), and records
 * every write instead of sending it.
 */
export function dryRunCms(reader) {
  const writes = []
  let next = 0
  const record = (tool, args, answer) => {
    writes.push({ tool, arguments: args })
    return answer
  }
  return {
    writes,
    taxonomy: () => (reader ? reader.taxonomy() : Promise.resolve([])),
    known: (externalId) => (reader ? reader.known(externalId) : Promise.resolve(null)),
    createRun: async (run) => record('createAgentRuns', run, 'dry-run'),
    updateRun: async (id, fields) => record('updateAgentRuns', { id, ...fields }, ''),
    submitSuggestion: async (args) =>
      record('submitSuggestion', args, { status: 'created', id: ++next }),
    reportItem: async (args) => record('reportItem', args, ''),
    close: async () => reader?.close?.(),
  }
}

/** The operations a run uses besides suggesting. */
const BESIDES_SUGGESTING = ['taxonomy', 'known', 'createRun', 'updateRun', 'reportItem', 'close']

/**
 * A client that can read, keep the run log and report, and has no way to suggest: no
 * `submitSuggestion` and no raw tool caller, under any spelling, because nothing but these
 * operations is on it. Every module of a run gets this one; only `submitItem` gets the real client
 * (#1007), where the gate runs first.
 */
export function withoutSuggestions(cms) {
  return Object.freeze(
    Object.fromEntries(
      BESIDES_SUGGESTING.filter((name) => typeof cms[name] === 'function').map((name) => [
        name,
        (...args) => cms[name](...args),
      ]),
    ),
  )
}
