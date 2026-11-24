// What the showcase's config files import that TypeScript has no types for: Vite's `import.meta.glob`
// and a Markdown file read as text (`?raw`). Only these two, so the site's own types stay untouched.
/// <reference types="vite/types/importMeta.d.ts" />

declare module '*.md?raw' {
  const text: string
  export default text
}
