import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'

import { expect } from '@playwright/test'

import { currentServer } from './server'

/** One email the site sent, as the SMTP catcher in serve.mjs stored it. */
export type CaughtEmail = { to: string[]; subject: string; text: string; html: string }

const mailDir = () => path.join(process.cwd(), currentServer().dataDir, 'mail')

/** Every email sent to an address so far, oldest first. */
export function emailsTo(address: string): CaughtEmail[] {
  const to = address.toLowerCase()
  const dir = mailDir()
  return readdirSync(dir)
    .sort()
    .map((file) => JSON.parse(readFileSync(path.join(dir, file), 'utf8')) as CaughtEmail)
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
  const { baseURL } = currentServer()
  const links = [
    ...email.html.matchAll(/href="([^"]+)"/g),
    ...email.text.matchAll(/(https?:\/\/\S+)/g),
  ]
    .map((match) => (match[1] ?? '').replaceAll('&amp;', '&'))
    .filter((href) => href.startsWith(baseURL))
    .map((href) => new URL(href))
    .filter((url) => url.pathname === pathname)
  const [url] = links
  if (!url) throw new Error(`No link to ${pathname} in "${email.subject}"`)
  return `${url.pathname}${url.search}`
}
