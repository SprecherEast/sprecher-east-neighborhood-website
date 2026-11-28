import type { sql } from '@payloadcms/db-sqlite'
import type { Payload } from 'payload'

/** Runs one raw SQL query on the database Payload booted on and returns its rows. */
export type Query = ReturnType<typeof sql>
type Rows<T> = { rows: T[] }
export type RawDb = { run: (query: Query) => Promise<unknown> }

export const rawDb = (payload: Payload) => payload.db.drizzle as unknown as RawDb

export async function sqlRows<T = Record<string, unknown>>(
  payload: Payload,
  query: Query,
): Promise<T[]> {
  return ((await rawDb(payload).run(query)) as Rows<T>).rows
}
