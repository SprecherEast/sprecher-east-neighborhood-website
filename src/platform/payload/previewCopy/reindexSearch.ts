import { createLocalReq, type Payload, type PayloadRequest } from 'payload'

import { PREVIEW_COPY } from './classification'

/**
 * Rebuilds the search index of a preview after the import (#1396). The import writes through the
 * adapter, which runs no hook, so nothing indexed the copied documents. This calls the search
 * plugin's own reindex endpoint, which is what its admin button does, so the entries are made by
 * the plugin and the site's own `beforeSync`, never by a copy of them here.
 *
 * The endpoint asks for staff access, so the call carries an account that exists only in this
 * request: nothing is stored, and no real account is read.
 */

type Endpoint = {
  path: string
  method: string
  handler: (req: PayloadRequest) => Promise<Response> | Response
}

/** Searches the collections its `doc` field can point at; the slug is the one classified `rebuilt`. */
export async function reindexSearch(payload: Payload): Promise<void> {
  const slug = Object.entries(PREVIEW_COPY).find(([, entry]) => entry.copy === 'rebuilt')?.[0]
  const search = slug ? payload.collections[slug as keyof typeof payload.collections] : undefined
  if (!slug || !search) throw new Error('Preview copy: the search collection is not in the config')

  const doc = (search.config.fields as { name?: string; relationTo?: unknown }[]).find(
    (field) => field.name === 'doc',
  )
  const collections = [doc?.relationTo ?? []].flat()
  const endpoint = ((search.config.endpoints as Endpoint[] | false | undefined) || []).find(
    (candidate) => candidate.path === '/reindex' && candidate.method === 'post',
  )
  if (!endpoint || collections.length === 0) {
    throw new Error('Preview copy: the search plugin has no reindex endpoint')
  }

  const req = await createLocalReq(
    { user: { collection: 'users', id: 0, role: 'admin' } as never },
    payload,
  )
  req.json = async () => ({ collections })
  const response = await endpoint.handler(req)
  if (!response.ok) throw new Error(`Preview copy: the search reindex answered ${response.status}`)
}
