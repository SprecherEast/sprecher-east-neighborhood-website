/** Small stand-ins for the loaded config, for the tests that compare a whole page (#1461). */

function release() {}
function tidy() {}
function pluginHook() {}
function handlerA() {}
function handlerB() {}
function isAdmin() {}
function checkKey() {}
function submit() {}
export const locate = (fn) =>
  ({
    [release]: 'src/platform/payload/hooks.ts',
    [tidy]: 'src/platform/payload/tidy.ts',
    [handlerA]: 'src/modules/a/cms/retention.ts',
    [handlerB]: 'src/modules/b/cms/retention.ts',
    [isAdmin]: 'src/platform/payload/roles.ts',
    [checkKey]: 'src/modules/agents/cms/mcp.ts',
    [submit]: 'src/modules/agents/cms/tools/submit.ts',
  })[fn] ?? 'payload'

/** The `jobs` config: two retention tasks with a schedule hook, and a task nobody schedules. */
export const jobsConfig = {
  tasks: [
    {
      slug: 'deleteOld',
      label: 'Delete old things',
      handler: handlerA,
      schedule: [
        { cron: '0 * * * *', queue: 'retention', hooks: { beforeSchedule: release } },
        { cron: '30 4 * * 1-5', queue: 'retention' },
      ],
    },
    {
      slug: 'deleteOlder',
      handler: handlerB,
      schedule: [
        {
          cron: '0 * * * *',
          queue: 'retention',
          hooks: { beforeSchedule: release, afterSchedule: tidy },
        },
        { cron: '5 * * * *', queue: 'extra', hooks: { beforeSchedule: pluginHook } },
      ],
    },
    { slug: 'schedulePublish', handler: () => ({}) },
  ],
  autoRun: [
    { cron: '*/10 * * * *', queue: 'retention' },
    { cron: '* * * * *', limit: 3, disableScheduling: true },
  ],
  access: { run: isAdmin, queue: isAdmin },
}

export const jobsReach = (file, slug, hook) =>
  hook
    ? [
        {
          collection: 'payload-jobs',
          operations: ['read (access bypassed)', 'update (access bypassed)'],
          why: [{ operation: 'update', text: 'Puts a stuck job back. Then says so.' }],
        },
      ]
    : file.endsWith('a/cms/retention.ts')
      ? [{ collection: 'old-things', operations: ['delete (access bypassed)'], why: [] }]
      : []

export const jobsExtras = {
  serverCrons: [
    {
      file: 'ops/install-cron.sh',
      cron: '15 8 * * *',
      runs: ['ops/backup.sh daily', 'ops/b.sh now'],
    },
  ],
  intelligence: {
    file: 'intelligence/pipeline.yaml',
    cron: '40 6 * * *',
    timezone: 'America/Chicago',
  },
  dependabot: [
    { file: '.github/dependabot.yml', ecosystem: 'npm', directory: '/', when: 'weekly on monday' },
  ],
}

export const jobsWorkflows = [
  {
    file: '.github/workflows/lint.yml',
    name: 'Lint',
    crons: ['0 6 * * *', '17 7 * * *'],
    jobs: ['Audit', 'Build'],
  },
]

/** The MCP plugin options: two collections, a global, one off, and one custom tool. */
export const mcpOptions = {
  collections: {
    zeta: { enabled: { find: true, create: true }, description: 'Zeta docs.' },
    alpha: { enabled: { find: true }, description: 'Alpha docs.' },
    off: { enabled: { find: false } },
  },
  globals: { header: { enabled: true } },
  overrideAuth: checkKey,
  mcp: {
    tools: [
      {
        name: 'submitSuggestion',
        description: 'Suggest a draft.',
        parameters: { title: 'shape' },
        handler: submit,
      },
      { name: 'plainTool', description: 'Does nothing.', parameters: {}, handler: () => 1 },
    ],
    serverOptions: { serverInfo: { name: 'Example', version: '1.0.0' } },
  },
}

export const mcpSchema = (shape) =>
  shape.title
    ? {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'The title.', minLength: 1, maxLength: 60 },
          kind: { type: 'string', enum: ['b', 'a'] },
          tags: { type: 'array', items: { type: 'string' }, maxItems: 3 },
          note: { anyOf: [{ type: 'string', maxLength: 9 }, { type: 'null' }] },
          link: { type: 'string', pattern: '^https?:\\/\\/[^\\s|]+$' },
        },
        required: ['title', 'kind'],
      }
    : { type: 'object', properties: {} }

export const mcpChecks = (shape) => (shape.title ? { tags: ['custom check: Each tag once'] } : {})

export const mcpAccess = new Map([
  ['alpha', [{ operation: 'read', name: 'isAdmin', file: 'src/platform/payload/roles.ts' }]],
])

export const mcpCalls = (file) =>
  file.endsWith('submit.ts')
    ? [
        {
          collection: 'zeta',
          operations: ['create (access checked)', 'read (access bypassed)'],
          why: [{ operation: 'read', text: 'Hidden drafts. Only the id goes back.' }],
        },
        { collection: 'alpha', operations: [], why: [] },
      ]
    : []

const countRoute = { method: 'GET', path: '/count', name: 'countHandler', file: 'payload' }
const loginRoute = { method: 'POST', path: '/login', name: 'loginHandler', file: 'payload' }
const takenRoute = {
  method: 'GET',
  path: '/access/:id?',
  name: 'accessHandler',
  file: 'payload',
  replacedBy: { method: 'GET', path: '/:key', name: 'keyHandler', file: '@payloadcms/plugin-seo' },
  replacedWhen: ['/access', '/access/x'],
}

/** The endpoints stand-in with more of everything a row can hold: two types on one route, a route taken for some requests by a plugin, a global's own endpoint, plugin and anonymous rules. */
export const moreApi = (base) => {
  const [events, faq, header, runs] = [0, 1, 2, 3].map((i) => base.contentTypes[i])
  const posts = { ...faq, slug: 'posts', allEndpoints: [countRoute] }
  return {
    ...base,
    mcpAuth: { name: 'the plugin’s own key check', file: '@payloadcms/plugin-mcp' },
    graphQL: {
      ...base.graphQL,
      rules: [
        ...base.graphQL.rules,
        { validationRule() {} }.validationRule,
        function limitDepth() {},
      ],
    },
    contentTypes: [
      { ...events, allEndpoints: [...events.allEndpoints, takenRoute] },
      { ...faq, allEndpoints: [countRoute, loginRoute] },
      posts,
      {
        ...header,
        endpoints: [{ method: 'GET', path: '/preview', name: 'preview', file: 'src/p.ts' }],
      },
      runs,
    ],
  }
}
