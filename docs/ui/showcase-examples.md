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
- **What the reader guarantees** (the generator fails the file otherwise; a static export draws every
  example at build time). Imports and markup are **allow lists, refused by default**; the names the
  reader knows are a short deny list on top:
  - **Imports:** only `react`, `lucide-react`, the format file (`@/platform/ui/example`, or
    `./example` from a file in the kit's own folder only) and kit components on the **safe list**,
    by `@/platform/ui/<name>` or by a relative path to a file in its own folder (one plain name
    or folder path per step: a `.` or `..` step, `testing/`, a test, a story or an examples file is
    refused). The safe list is the only list, in every folder: `./Media`, `./AdminBar.client`,
    `./example` beside rich text and `./RichText` are refused, so a component off the list cannot
    have examples until a reviewed change puts it on it (#1539 for rich text). No dynamic `import()`,
    `require`, `import x = require` or `import.meta`, and no re-export.
  - **The safe list** is computed, not written: the reference's component files under the kit,
    minus every one whose imports, followed all the way down, reach `payload` or a `@payloadcms/`
    package, `server-only`, a Node built-in (`fs`, `node:…`), `next/dist/server`, a server folder
    (`modules`, `app`, `endpoints`, `platform/payload`, `platform/service`), `process`,
    `globalThis.process`, `import.meta`, `module` or an import whose path is not a literal
    (`scripts/reference/kitFiles.mjs`). Today that drops `AdminBar`, `LivePreviewListener`,
    `Breadcrumbs`, `Media` and the others that reach the URL helpers.
  - **Markup** (`scripts/reference/examplesMarkup.mjs`): a JSX tag is one of a short list of plain
    elements (`div`, `span`, `p`, `ul`, `ol`, `li`, `strong`, `em`, `small`, `code`, `pre`, `br`,
    `hr`, `h1` to `h6`, `section`, and the svg shapes `svg`, `g`, `path`, `circle`, `ellipse`,
    `rect`, `line`, `polyline`, `polygon`) or a component that is imported or written as a function
    in the file. No `style`, `script`, media, frame, form, `link`, `meta`, `a` or other element, no
    computed element name, no `createElement`, `cloneElement` or `jsx`, no
    `dangerouslySetInnerHTML`. An address attribute (`src`, `srcSet`, `href`, `action`, `poster`,
    `data` and the like) is a literal that is relative or a fragment; `href` may also be a reserved
    example address (`https://example.com`). No `javascript:` address and no `url(`, `image-set(`,
    `src(` or `@import` in a string or a style. No `innerHTML`, `outerHTML`, `insertAdjacent…`,
    `ownerDocument`, `defaultView`, `srcdoc`, `contentWindow`, `contentDocument`, `constructor` or
    `__proto__`, as a name or a string key.
  - **Names:** no reference to the environment, machine, network, page or timers that the reader
    knows (`process`, `global`, `module`, `exports`, `Buffer`, `Reflect`, `Proxy`, `Worker`, `Deno`,
    `Bun`, `fetch`, `WebSocket`, `RTCPeerConnection`, `WebTransport`, `window`, `document`,
    `location`, `localStorage`, `setTimeout`, `requestAnimationFrame`, `open`, `alert`, `Image`
    (the icon is imported as `ImageIcon`) and the rest of `FORBIDDEN` in
    `scripts/reference/examplesChecks.mjs`).
  - **Shape:** every export is a `defineExample`, with only the entries above, valid settings and a
    file with no syntax error. A server file passes no handler and uses no hook. The lint rules for
    pages (the kit, not raw tags; theme tokens only) apply too.
    Widening any list is a reviewed change to those files.
- **What it does not guarantee: this is a guard against mistakes, not a sandbox.** The reader reads
  the file's text and refuses what a slip, or code written without thinking, would do. An example is
  still code that runs at build time in a reviewed repository file, so review stays the control.
  - **Kit components and packages are trusted.** A safe-listed kit component may do what it does:
    `VersionCheck.client` fetches `/api/version` and `MapEmbed.client` draws an iframe, and both are
    on the list. The packages the list reaches are trusted unread, except the server ones named
    above. The list sees only the shapes named above, so a kit file that reaches the environment
    another way (a computed key, `next/dist` internals other than `server`) stays on it.
  - **Deny lists cannot be complete.** A global, member or element name the reader does not know,
    a name or key built from pieces (`'con' + 'structor'`, a template), and a route through
    `Object.getPrototypeOf` and property descriptors to the `Function` constructor all get past it.
  - **What the framework blocks** is not the reader's doing: React refuses a `javascript:` address
    when it renders, and a component's own types limit what its `as` accepts.
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
