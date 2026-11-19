import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'

import { expect } from '@playwright/test'

import { E2E } from './settings.mjs'

/** One email the site sent, as the SMTP catcher in serve.mjs stored it. */
export type CaughtEmail = { to: string[]; subject: string; text: string; html: string }

const mailDir = path.join(process.cwd(), E2E.dataDir, 'mail')

/** Every email sent to an address so far, oldest first. */
export function emailsTo(address: string): CaughtEmail[] {
  const to = address.toLowerCase()
  return readdirSync(mailDir)
    .sort()
    .map((file) => JSON.parse(readFileSync(path.join(mailDir, file), 'utf8')) as CaughtEmail)
    .filter((email) => email.to.includes(to))
}

/** Waits for the `nth` email (1-based) to an address and answers it. */
export async function nthEmailTo(address: string, nth = 1): Promise<CaughtEmail> {
  await expect.poll(() => emailsTo(address).length, { timeout: 20_000 }).toBeGreaterThanOrEqual(nth)
  const email = emailsTo(address)[nth - 1]
  if (!email) throw new Error(`No email ${nth} to ${address}`)
  return email
}

/** The site link in an email that goes to a path, as a path the test can open. */
export function linkTo(email: CaughtEmail, pathname: string): string {
  const links = [
    ...email.html.matchAll(/href="([^"]+)"/g),
    ...email.text.matchAll(/(https?:\/\/\S+)/g),
  ]
    .map((match) => (match[1] ?? '').replaceAll('&amp;', '&'))
    .filter((href) => href.startsWith(E2E.baseURL))
    .map((href) => new URL(href))
    .filter((url) => url.pathname === pathname)
  const [url] = links
  if (!url) throw new Error(`No link to ${pathname} in "${email.subject}"`)
  return `${url.pathname}${url.search}`
}
