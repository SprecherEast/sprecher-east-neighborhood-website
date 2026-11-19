// The architecture's dependency rules as lint (docs/architecture/README.md#dependency-rules).
// Errors since every area moved out of the template folders (#137).
import boundaries from 'eslint-plugin-boundaries'

// A module's entry files: the only files code outside the module may import (rule 2)
const ENTRY_FILES = '{index,server,actions,cms}.ts'

// Runtime Payload: the framework, its packages and the config (rule 6). `import type` is fine.
const PAYLOAD = [
  { to: { module: { source: ['payload', '@payloadcms/*'] } }, dependency: { kind: 'value' } },
  { dependency: { source: '@payload-config', kind: 'value' } },
]

// Chart libraries (#639, decision 0018): only an adapter folder draws with one; everything else
// draws through `Chart`, so a library can be swapped without touching a page.
const CHART_LIBRARIES = [
  { to: { module: { source: ['@visx/*', 'd3-*', 'recharts', 'echarts', '@nivo/*'] } } },
]

// Pages and routes that still query Payload themselves. Each leaves this list when its area moves
// to a module (#131 to #136); any other file in src/app/ that does it fails lint (#137).
const STILL_QUERYING_PAYLOAD = [
  '(frontend)/next/preview/route.ts',
  '(frontend)/next/seed/route.ts',
].map((file) => `src/app/${file}`.replace(/[\\()[\]{}*?!+@]/g, '\\$&')) // escape glob characters

// Inside a module, what each part must not import from the same module (rules 1, 4 and 5).
// Entry files never import each other; inner folders import folders, not entry files.
const LAYER_LIMITS = [
  ['domain/**', ['{use-cases,data,cms,ui}/**', ENTRY_FILES], 'domain/ imports no other layer'],
  ['use-cases/**', ['{cms,ui}/**', ENTRY_FILES], 'use-cases/ imports only domain/ and data/'],
  ['data/**', ['{use-cases,cms,ui}/**', ENTRY_FILES], 'data/ imports only domain/'],
  [
    'cms/**',
    ['{use-cases,data,ui}/**', ENTRY_FILES],
    'cms/ imports only domain/ (no server-only code)',
  ],
  [
    'ui/**',
    ['cms/**', '{index,server,cms}.ts'],
    'ui/ imports only domain/, use-cases/, actions.ts and, in server components, data/',
  ],
  // A plain read has no use case (#521), so a server component may read data/; browser code (the
  // *.client files, headless use* hooks and the ui/api.ts browser clients) may not
  [
    'ui/**/{*.client.{ts,tsx},use*.ts,api.ts}',
    ['data/**'],
    'client code gets DTOs as props and never imports data/ (rule 5)',
  ],
  [
    'index.ts',
    ['{use-cases,data,cms,ui}/**', '{server,actions,cms}.ts'],
    'index.ts holds types and pure rules: domain/ only',
  ],
  [
    'server.ts',
    ['cms/**', '{index,actions,cms}.ts'],
    'server.ts exports domain/, use-cases/, data/ reads and ui/ only',
  ],
  [
    'cms.ts',
    ['{use-cases,data,ui}/**', '{index,server,actions}.ts'],
    'cms.ts exports cms/ and domain/ only',
  ],
  [
    'actions.ts',
    ['{cms,ui}/**', '{index,server,cms}.ts'],
    'actions.ts calls use cases, not ui/ or cms/',
  ],
]

const rule = (number) => `docs/architecture/README.md rule ${number}`

export const boundariesConfig = {
  files: ['src/**/*.{ts,tsx}'],
  plugins: { boundaries },
  settings: {
    'boundaries/elements': [
      { type: 'app', pattern: 'src/app', partialMatch: false },
      { type: 'module', pattern: 'src/modules/*', partialMatch: false, capture: ['module'] },
      { type: 'platform', pattern: 'src/platform', partialMatch: false },
      // The one template folder that stays: seed data and its script. ESLint skips it (and the
      // generated migrations/ and app/(payload)/), so only its importers are checked.
      { type: 'seed', pattern: 'src/endpoints/seed', partialMatch: false },
    ],
    'boundaries/files': [
      // Root files (payload.config.ts, proxy.ts) belong to no element; this makes them checked
      { pattern: 'src/*.ts', category: 'root' },
      { pattern: STILL_QUERYING_PAYLOAD, category: 'still-querying-payload' },
    ],
  },
  rules: {
    // A file outside every element above (a new top-level folder in src/) fails lint: give it a
    // home in app/, a module or platform/ instead
    'boundaries/no-unknown-files': 'error',
    'boundaries/dependencies': [
      'error',
      {
        // Only these policies apply
        default: 'allow',
        checkAllOrigins: true,
        checkUnknownLocals: true,
        checkInternals: true,
        policies: [
          {
            disallow: { to: { element: { type: 'module', fileInternalPath: `!${ENTRY_FILES}` } } },
            message: `Import a module only through its entry files (${rule(2)})`,
          },
          {
            from: { element: { type: 'app' } },
            disallow: { to: { element: { type: 'module', fileInternalPath: 'cms.ts' } } },
            message: `Only payload.config.ts imports a module's cms.ts (${rule(2)})`,
          },
          {
            from: { element: { type: ['module', 'platform'] } },
            disallow: { to: { element: { type: ['module', 'app'] } } },
            message: `No module imports another, and platform/ imports none: compose them in src/app/ or payload.config.ts (${rule(3)})`,
          },
          {
            from: { element: { type: ['module', 'platform'] } },
            disallow: { to: { element: { type: 'seed' } } },
            message: `Only src/app/ uses the seed (${rule(3)})`,
          },
          // A module's own files may import each other; the layer limits below narrow this
          { allow: { dependency: { relationship: { to: 'internal' } } } },
          ...LAYER_LIMITS.map(([from, to, why]) => ({
            from: { element: { type: 'module', fileInternalPath: from } },
            disallow: {
              to: { element: { type: 'module', fileInternalPath: to } },
              dependency: { relationship: { to: 'internal' } },
            },
            // A limit that names its own rule (the client one) doesn't get rule 1 added
            message: why.includes('(rule ') ? why : `${why} (${rule(1)})`,
          })),
          {
            from: [
              { element: { type: 'app' } },
              { element: { type: 'module', fileInternalPath: '!{data/**,cms/**,cms.ts}' } },
            ],
            disallow: PAYLOAD,
            message: `Runtime Payload only in a module's data/ or cms/ (${rule(6)})`,
          },
          { from: { file: { categories: 'still-querying-payload' } }, allow: PAYLOAD },
          {
            from: [
              { element: { type: ['app', 'module'] } },
              { element: { type: 'platform', fileInternalPath: '!ui/chart/adapters/**' } },
            ],
            disallow: CHART_LIBRARIES,
            message:
              'Chart libraries only inside src/platform/ui/chart/adapters/: draw with Chart from @/platform/ui/chart/Chart (#639)',
          },
          {
            from: { element: { type: 'module', fileInternalPath: 'domain/**' } },
            disallow: {
              to: {
                module: {
                  source: ['next', 'react', 'react-dom', 'payload', '@payloadcms/*'],
                },
              },
              dependency: { kind: 'value' },
            },
            message: `The domain imports no framework (${rule(1)})`,
          },
          {
            from: { element: { type: 'module', fileInternalPath: 'domain/**' } },
            disallow: { to: { element: { type: 'platform', fileInternalPath: '!lib/**' } } },
            message: `The domain may use only platform/lib/ (${rule(1)})`,
          },
        ],
      },
    ],
  },
}
