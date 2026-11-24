/** Small stand-ins for the loaded config, for the tests that compare a whole page (#1461). */

function release() {}
function handlerA() {}
function handlerB() {}
function isAdmin() {}
function checkKey() {}
function submit() {}
export const locate = (fn) =>
  ({
    [release]: 'src/platform/payload/hooks.ts',
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
      schedule: [{ cron: '0 * * * *', queue: 'retention', hooks: { beforeSchedule: release } }],
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
