/** The job config and links the jobs tests and the jobs page tests share. */

export function retain() {}
export const locate = (fn) => (fn === retain ? 'src/modules/a/cms/retention.ts' : 'payload')
export const config = {
  tasks: [
    {
      slug: 'deleteOld',
      label: 'Delete old things',
      handler: retain,
      schedule: [{ cron: '0 * * * *', queue: 'retention' }],
    },
    { slug: 'schedulePublish', handler: () => ({}) },
  ],
  autoRun: [
    { cron: '*/10 * * * *', queue: 'retention' },
    { cron: '* * * * *', queue: 'default', limit: 10, disableScheduling: true },
  ],
  access: { run: function isAdminBoolean() {}, queue: function isStaff() {} },
}

export const extras = {
  serverCrons: [{ file: 'ops/install-cron.sh', cron: '15 8 * * *', runs: ['ops/backup.sh daily'] }],
  intelligence: {
    file: 'intelligence/pipeline.yaml',
    cron: '40 6 * * *',
    timezone: 'America/Chicago',
  },
  dependabot: [
    { file: '.github/dependabot.yml', ecosystem: 'npm', directory: '/', when: 'weekly on monday' },
  ],
}
