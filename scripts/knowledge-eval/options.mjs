import { parseArgs } from 'node:util'

const wholeNumber = (value, name) => {
  const n = Number(value)
  if (!Number.isInteger(n) || n < 1) throw new Error(`${name} must be a whole number of 1 or more`)
  return n
}

/** The runner's command line: the two commits, how many runs of each task, and which tasks. */
export function parseOptions(argv) {
  const { values } = parseArgs({
    args: argv,
    options: {
      a: { type: 'string' },
      b: { type: 'string' },
      runs: { type: 'string', default: '2' },
      tasks: { type: 'string' },
      set: { type: 'string', default: 'all' },
      jobs: { type: 'string', default: '1' },
      out: { type: 'string' },
      model: { type: 'string', default: 'sonnet' },
      effort: { type: 'string', default: 'medium' },
    },
  })
  for (const name of ['a', 'b']) {
    if (!values[name]) throw new Error(`--${name} <commit> is required`)
  }
  if (!['all', 'core'].includes(values.set)) throw new Error('--set must be all or core')
  return {
    a: values.a,
    b: values.b,
    runs: wholeNumber(values.runs, '--runs'),
    jobs: wholeNumber(values.jobs, '--jobs'),
    set: values.set,
    tasks: values.tasks ? values.tasks.split(',').map((id) => id.trim()) : null,
    out: values.out ?? null,
    model: values.model,
    effort: values.effort,
  }
}
