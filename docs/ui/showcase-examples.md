# Showcase examples

One examples file beside each component is the one source of what the showcase shows, what the
tests render and what the generated index lists (#1532, epic #1528).

- **Where:** `Tabs.client.tsx` has `Tabs.examples.tsx` and, when it needs one, `Tabs.examples.client.tsx`,
  in the same folder (the `.client` of the component's own name drops out). A file holding several
  components has one pair of examples files.
- **Server or client:** the first file is a **server** examples file, drawn by a server page. An
  example whose `render` passes an event handler, uses state or effects, or draws a component that
  puts a function on its element (a `Button` with `loading`, a `Badge` with `onPress`) is a **client**
  example and lives in the `.examples.client.tsx` file, which starts with `'use client'`. The reader
  refuses a handler (`onPress`, `onClick`…) or a hook in a server file, and a server file that starts
  with `'use client'`; the test `examples.server.test.ts` draws every server example with the
  framework's own server renderer, so a function passed across the boundary fails it. A client
  example is drawn from a client component (a client module's exports cannot be called from a
  server component); the index says which kind each example is.
- **What:** each export is one configuration, written `export const SecondTabOpen =
defineExample({ purpose, render, settings?, of? })` with `defineExample` from `./example`. The
  export name (a capital letter, then letters and digits) is its title ("Second tab open") and its
  link (`#second-tab-open`); it is curated and meaningful, not a combination. `purpose` is one line of
  at most 120 characters and is shown beside the example. `render` is a pure function of the
  settings that returns elements. `settings` lists what a visitor may change, each as `boolean`,
  `choice` (with `options`) or `text`, with the `default` it starts at and an optional
  `description`. `of` names the components it shows, when not just the one named like the file.
- **Source to copy:** the source shown for an example is its `render` function, preceded by the
  helpers it uses from the same file (the constants, functions and types it names, and what those
  name), so what is shown runs once the imports are added. A helper is not exported.
- **One definition:** a list of a component's variants is not written again in an example. The
  showcase's interactive panel takes the variants from the index; an example that shows them all
  keys a `Record` by the prop's type, so a new variant fails the type-check until it is listed. A
  shared constant (`EXAMPLE_ROW`) lives in `example.ts`.
- **What an examples file may do** (the generator fails it otherwise; a static export draws it, with
  no CMS, secret or network): import only `react`, `lucide-react`, `./example` and the kit components on the safe list, by `@/platform/ui/<name>` or by a relative path to a file in its own folder (one plain name
  or folder path per step: a `.` or `..` step, `testing/`, a test, a story or an examples file is
  refused). The safe list is the only list, in every folder (`./Media`, `./AdminBar.client` and,
  beside rich text, `./RichText` are refused): a component off it cannot be reached by either path,
  and so cannot have examples until a reviewed change puts it on the list (#1539 for rich text).
  The safe list is computed, not written: the reference's component files under the kit,
  minus every one whose imports, followed all the way down, reach `payload` or a `@payloadcms/`
  package, `server-only`, a Node built-in (`fs`, `node:…`), a server folder (`modules`, `app`, `endpoints`,
  `platform/payload`, `platform/service`) or `process`, `globalThis.process`, `import.meta`, `module` or an import whose path is not a literal
  (`scripts/reference/kitFiles.mjs`); today that drops
  `AdminBar`, `LivePreviewListener`, `Breadcrumbs`, `Media` and the others that reach the URL
  helpers. No dynamic `import()`, `require`, `import x = require` or `import.meta`; no reference to
  the environment, machine, network, page or timers (`process`, `global`, `module`, `exports`,
  `Buffer`, `__dirname`, `Reflect`, `Proxy`, `Worker`, `Deno`, `Bun`, `fetch`, `WebSocket`,
  `window`, `document`, `location`, `localStorage`, `setTimeout`, `requestAnimationFrame`, `open`,
  `Image` (use the `ImageIcon` name for the icon) and the like; the full list is
  `FORBIDDEN` in `scripts/reference/examplesChecks.mjs`) and no way to `constructor` or `__proto__`,
  anywhere in the file; no `<script>`, `<iframe>`, `<object>`, `<embed>`, `<link>`, `<meta>`,
  `<base>` or `<form>`, no `dangerouslySetInnerHTML` and no `javascript:` address; every export a `defineExample`, with only the entries above, valid settings
  and a file with no syntax error. Anything else is refused by default; widening a list (for
  example the kit files, for rich text examples, #1539) is a reviewed change. The lint rules for
  pages (the kit, not raw tags; theme tokens only) apply too.
- **Re-exports** (`export … from`, `export * from`) are refused anywhere in an examples file: it
  exports only examples.
- **A guard against mistakes, not a sandbox:** the reader reads the file's text and refuses what a
  slip would do. An example is still code that runs at build time, so a person who means harm can
  write what it misses: a name or key built from pieces (`'con' + 'structor'`, a template), a route
  through `Object.getPrototypeOf` and property descriptors to the `Function` constructor, and
  anything a safe-listed kit file or package does, since packages are trusted unread except the
  server ones listed above; and the kit list sees only the shapes named above, so a kit file that
  reaches the environment another way (a computed key, `next/dist` internals other than `server`)
  would stay on it. Review of the examples file stays the control.
- **The index** (`docs/reference/showcase-index.json`, `npm run docs:generate`, checked by
  `docs:check` in `Knowledge sync`) holds, for every shared component: its group, description,
  props (with the values of each variant), parts, the files that use it with their count, and its
  examples (name, link, purpose, settings, kind, file, the line they start on, and the source
  above). A component with no examples has `examples: null` and is in `coverage.missing`.
- **The import map** (`src/platform/ui/showcaseRegistry.ts`, generated by the same run and checked
  by the same `docs:check`) has a lazy `import()` for every component (`COMPONENT_LOADERS`, by
  name) and every examples file (`EXAMPLES_LOADERS`, by the `file` of an example), so a page loads
  them by name without a list kept by hand.
- **Tests:** `examples.test.tsx` renders every examples file (server and client) as it starts and
  with each setting changed, with axe, and checks it exports what the index reads;
  `examples.server.test.ts` draws the server ones on the server; `showcaseRegistry.test.ts` checks
  the import map covers the index.
- **Uses:** an examples file is not a use of a component, so it is not counted in "Used by".
