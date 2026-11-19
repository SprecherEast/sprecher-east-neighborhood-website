// Starts the site for the end-to-end tests (#311): a fresh SQLite database, migrated and seeded
// with the contact form, a production build, and an SMTP catcher that stores every email the
// site sends as a JSON file the tests read. Nothing reaches a real mail server or Cloudflare: the
// robot check is off (no Turnstile keys), as it is in local development.
import { spawn, spawnSync } from 'node:child_process'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { simpleParser } from 'mailparser'
import { SMTPServer } from 'smtp-server'

import { E2E } from './support/settings.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dataDir = path.join(root, E2E.dataDir)

rmSync(dataDir, { recursive: true, force: true })
mkdirSync(path.join(dataDir, 'mail'), { recursive: true })

// Every value the site reads to reach a service or shape its answers is set here, so none comes
// from a developer's .env.local (Next keeps a value that's already set, even an empty one)
// E2E_DEV=1 runs `next dev` instead of a production build: for writing tests on a machine that
// can't build (next/font fetches Poppins from Google Fonts at build time). CI always builds.
const dev = Boolean(process.env.E2E_DEV)
const env = {
  ...process.env,
  NODE_ENV: dev ? 'development' : 'production',
  DATABASE_URI: `file:./${E2E.dataDir}/e2e.db`,
  PAYLOAD_SECRET: 'e2e-only-secret-not-used-anywhere-else-0123456789',
  PREVIEW_SECRET: 'e2e-only-preview-secret',
  NEXT_PUBLIC_SERVER_URL: E2E.baseURL,
  SMTP_HOST: '127.0.0.1',
  SMTP_PORT: String(E2E.smtpPort),
  SMTP_USER: '',
  SMTP_PASS: '',
  SMTP_FROM_ADDRESS: 'no-reply@example.com',
  SMTP_FROM_NAME: 'Sprecher East',
  CONTACT_NOTIFY_EMAIL: E2E.ownerEmail,
  CONTACT_EMAIL_FROM: '',
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: '',
  TURNSTILE_SECRET_KEY: '',
  TURNSTILE_ALLOWED_HOSTNAMES: '',
  SITE_TIMEZONE: 'America/Chicago',
  NEXT_TELEMETRY_DISABLED: '1',
}

// The catcher: no login, no TLS, one JSON file per message
let received = 0
const smtp = new SMTPServer({
  authOptional: true,
  disabledCommands: ['STARTTLS', 'AUTH'],
  logger: false,
  onData(stream, _session, done) {
    simpleParser(stream)
      .then((mail) => {
        received++
        const file = path.join(
          dataDir,
          'mail',
          `${Date.now()}-${String(received).padStart(6, '0')}.json`,
        )
        writeFileSync(
          file,
          JSON.stringify({
            to: mail.to?.value?.map((a) => a.address?.toLowerCase()) ?? [],
            subject: mail.subject ?? '',
            text: mail.text ?? '',
            html: typeof mail.html === 'string' ? mail.html : '',
          }),
        )
        done()
      })
      .catch(done)
  },
})
smtp.listen(E2E.smtpPort, '127.0.0.1')

const run = (args) => {
  const result = spawnSync('npx', args, { cwd: root, env, stdio: 'inherit' })
  if (result.status !== 0) {
    smtp.close()
    process.exit(result.status ?? 1)
  }
}

// A production build runs the migrations, as the deploy does; in development Payload pushes the
// schema itself on start, and the migrations would clash with that
if (!dev) run(['payload', 'migrate'])
run(['payload', 'run', 'e2e/seed.ts'])
if (!dev) run(['next', 'build'])

const server = spawn('npx', ['next', dev ? 'dev' : 'start', '-p', String(E2E.port)], {
  cwd: root,
  env,
  stdio: 'inherit',
})
const stop = () => {
  server.kill()
  smtp.close()
}
process.on('SIGTERM', stop)
process.on('SIGINT', stop)
server.on('exit', (code) => {
  smtp.close()
  process.exit(code ?? 0)
})
