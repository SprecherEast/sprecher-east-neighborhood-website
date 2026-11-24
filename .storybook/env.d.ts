// What the showcase's config files import that TypeScript has no types for: Vite's `import.meta.glob`
// and a Markdown file read as text (`?raw`). This folder has its own tsconfig.json, so Vite's types
// reach only these files and never the site's code (check it with `npm run typecheck:storybook`).
/// <reference types="vite/types/importMeta.d.ts" />

declare module '*.md?raw' {
  const text: string
  export default text
}
