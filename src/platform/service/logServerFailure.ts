import 'server-only'

/**
 * Logs that a server call failed on our side, with only the error's class name. Never the error
 * itself: a database error carries the query's values, such as an email (#231, #521).
 */
export function logServerFailure(action: string, error: unknown): void {
  const name = error instanceof Error ? error.name : typeof error
  console.error(`${action} failed on the server (${name})`)
}
