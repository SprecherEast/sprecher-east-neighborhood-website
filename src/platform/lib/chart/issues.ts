import { chartSpecSchema } from './spec'

/**
 * What is wrong with a chart, as plain data: each reason with the path of the property it is about
 * (`['data', 0, 'value']`). An editor's block shows them as field errors, and an agent's Markdown
 * tag gets them back in the refusal, both from the same `ChartSpec` rules (#640).
 */
export type ChartIssue = { path: (string | number)[]; message: string }

export function chartIssues(input: unknown): ChartIssue[] {
  const result = chartSpecSchema.safeParse(input)
  if (result.success) return []
  return result.error.issues.map((issue) => ({
    path: issue.path.filter((part): part is string | number => typeof part !== 'symbol'),
    message: issue.message,
  }))
}

/** The reasons in one sentence each, joined: "title: Too small…; data.0.value: Too small…" */
export function describeChartIssues(issues: readonly ChartIssue[]): string {
  return issues
    .map(({ path, message }) => (path.length > 0 ? `${path.join('.')}: ${message}` : message))
    .join('; ')
}

/** A chart that fails its rules; the message lists every reason */
export class InvalidChartError extends Error {
  constructor(
    readonly issues: readonly ChartIssue[],
    prefix = '',
  ) {
    super(`${prefix}${describeChartIssues(issues)}`)
    this.name = 'InvalidChartError'
  }
}
