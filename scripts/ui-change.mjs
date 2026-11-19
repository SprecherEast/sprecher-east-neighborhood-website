/**
 * Which changed files change how the site looks (#868): the rules behind the end-to-end gate
 * (`.github/scripts/e2e-gate.mjs`). They sit on the knowledge classifier in `behavior-change.mjs`:
 * a file counts when its path is a UI path and `classifyFile` calls its diff behavior, so
 * comment-only and formatting-only edits, tests and docs never count. Input is a file of GitHub's
 * `pulls.listFiles`: `{ filename, previous_filename?, status, patch? }`.
 */
import { classifyFile } from './behavior-change.mjs'

/**
 * Where the pixels come from, by path. The UI kit, the rich-text renderer and the theme under
 * `src/platform/`, the theme files, any module's `ui/` folder, the Turnstile widget, and the
 * frontend's pages, layouts and components (`.tsx`) under `src/app/(frontend)/`. Any stylesheet in
 * `src`, the Tailwind and PostCSS config, and the tab and home-screen icons in `src/app/` count
 * too. Server actions, route handlers, data and domain code do not, even when they change what a
 * page says: the knowledge check covers those, this one only asks whether a browser test of the
 * screens is due.
 */
const UI_PATHS = [
  /^src\/platform\/(?:ui|richtext|theme|turnstile)\/.+\.(?:[cm]?[jt]sx?|s?css)$/,
  /^src\/themes\/.+\.(?:s?css|[cm]?[jt]sx?)$/,
  /^src\/modules\/[^/]+\/ui\/.+\.(?:[cm]?[jt]sx?|s?css)$/,
  /^src\/app\/\(frontend\)\/.+\.tsx$/,
  /^src\/app\/(?:global-error\.tsx|icon\.svg|favicon\.ico|apple-icon\.png)$/,
  /^src\/.+\.s?css$/,
  /^(?:tailwind|postcss)\.config\.[cm]?js$/,
]
/** Folders inside the UI paths that hold test support and snapshots, which draw nothing */
const NOT_UI = [/(^|\/)testing\//, /(^|\/)__snapshots__\//]

/** True when a path alone says the file draws part of the site */
export const isUiPath = (path) =>
  UI_PATHS.some((pattern) => pattern.test(path)) && !NOT_UI.some((pattern) => pattern.test(path))

/**
 * The files of a pull request that change how the site looks: a UI path (`isUiPath`; the old name
 * counts too, so moving a file out of the UI shows) whose change `classifyFile` calls behavior.
 * Each entry is the file with the `reason` its classification gave. Limits: a comment after code
 * on the same line, a JSX comment (`{/* … *\/}`) and a changed string or class name are code, so
 * they count; a file with no readable diff counts; a UI change made outside these paths (an image
 * in `public/`, Payload content) does not, and shows up as a miss in the measurement.
 *
 * @param {{ filename: string, previous_filename?: string, status?: string, patch?: string }[]} files
 */
export function uiChanges(files) {
  const found = []
  for (const file of files) {
    if (!isUiPath(file.filename) && !(file.previous_filename && isUiPath(file.previous_filename))) {
      continue
    }
    const { kind, reason } = classifyFile(file)
    if (kind === 'behavior') found.push({ ...file, reason })
  }
  return found
}

/** True when the pull request changes the UI, so the browser tests are due (#868) */
export const isUiChange = (files) => uiChanges(files).length > 0
