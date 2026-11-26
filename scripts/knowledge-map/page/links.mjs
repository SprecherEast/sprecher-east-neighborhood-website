/**
 * The links a node opens (#1463): its file on GitHub, in an editor on this computer, and a live
 * search of the open issues that name it. Pure. A path is repo-relative; one that could climb out
 * of the repository, or is not plain text, gives no link.
 */

const SAFE = /^[\w@()[\].+~ -]+(\/[\w@()[\].+~ -]+)*$/

/** The path as segments, or null when it is not a plain repo-relative path. */
function clean(path) {
  if (typeof path !== 'string' || !SAFE.test(path)) return null
  const parts = path.split('/')
  return parts.some((part) => part === '..' || part === '.') ? null : parts
}

const encoded = (parts) => parts.map(encodeURIComponent).join('/')
const hasExtension = (parts) => /\.[A-Za-z0-9]+$/.test(parts.at(-1))

/** The node's file (or folder) on GitHub, on the main branch. */
export function githubUrl(repo, path) {
  const parts = clean(path)
  if (parts === null) return null
  const kind = hasExtension(parts) ? 'blob' : 'tree'
  return `https://github.com/${repo.owner}/${repo.name}/${kind}/main/${encoded(parts)}`
}

/** A `vscode://` link into the reader's own checkout, whose folder they gave once. */
export function editorUrl(folder, path) {
  const parts = clean(path)
  const root = String(folder ?? '')
    .trim()
    .replaceAll('\\', '/')
    .replace(/\/+$/, '')
  if (parts === null || root === '' || /[\u0000-\u001f<>"]/.test(root)) return null
  const absolute = root.startsWith('/') ? root : `/${root}`
  return `vscode://file${encodeURI(absolute)}/${parts.join('/')}`
}

/** A live GitHub search of the open issues that mention the path. */
export function issueSearchUrl(repo, path) {
  const query = `is:issue is:open ${path}`
  return `https://github.com/${repo.owner}/${repo.name}/issues?q=${encodeURIComponent(query)}`
}

/** Only a GitHub issue link from the snapshot is followed; anything else shows as plain text. */
export const safeIssueUrl = (url) =>
  /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/issues\/\d+$/.test(url) ? url : null
