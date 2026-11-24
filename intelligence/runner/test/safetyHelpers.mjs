import { classifySafety } from '../lib/safety.mjs'
import { candidate, curation, draft, verification } from './fixtures.mjs'
import { contract } from './helpers.mjs'

// Items for the safety tests (#1007): a clean one by default, changed field by field.

export const item = ({ candidate: c, verification: v, curation: cu, draft: d, source } = {}) => ({
  candidate: candidate(c),
  ...(source ? { source } : {}),
  verification: verification(v),
  curation: curation(cu),
  ...(d ? { draft: draft(d) } : {}),
})
export const titled = (title, extra = {}) => item({ candidate: { title, ...extra } })
export const classify = (value) => classifySafety(contract.safety, value)
export const isSafety = (text) => classify(titled(text)).safety
