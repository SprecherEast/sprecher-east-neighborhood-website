// The environment the ops scripts act on (#1073): production when none is named, one pull request
// preview when PREVIEW_NUMBER is. Every value is read through ops/lib.sh the way the scripts do.
import { execFileSync, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { OPS } from './umami-harness.mjs'

const PRODUCTION = '/var/www/sprecher-east'
const NAMES = [
  'ENVIRONMENT',
  'APP_DIR',
  'APP_NAME',
  'APP_PORT',
  'ENV_FILE',
  'DATA_DIR',
  'MEDIA_DIR',
  'CADDY_SITE_FILE',
  'KEEP_RELEASES',
  'SITE_URL',
]
const ECOSYSTEM = path.join(OPS, '..', 'ecosystem.config.cjs')
const APP_OF = `console.log(JSON.stringify(require(${JSON.stringify(ECOSYSTEM)}).apps[0]))`

/** Runs `script` in bash after sourcing lib.sh, with only `env` (and PATH) set. */
function run(env, script) {
  return spawnSync('bash', ['-c', `. "${OPS}/lib.sh"; ${script}`], {
    env: { PATH: process.env.PATH, ...env },
    encoding: 'utf8',
  })
}
const printed = (env, script) =>
  execFileSync('bash', ['-c', `. "${OPS}/lib.sh"; ${script}`], {
    env: { PATH: process.env.PATH, ...env },
    encoding: 'utf8',
  })

const values = (env = {}) =>
  Object.fromEntries(
    printed(env, `for v in ${NAMES.join(' ')}; do printf '%s=%s\\n' "$v" "\${!v-}"; done`)
      .trim()
      .split('\n')
      .map((line) => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)]),
  )
const pm2App = (env = {}) => JSON.parse(printed(env, `node -e '${APP_OF}'`))
const umamiPort = () =>
  Number(
    /UMAMI_PORT="\$\{UMAMI_PORT:-(\d+)\}"/.exec(
      fs.readFileSync(path.join(OPS, 'umami-lib.sh'), 'utf8'),
    )?.[1],
  )
const range = () => {
  const [min, max] = printed({}, 'echo $PREVIEW_PORT_MIN $PREVIEW_PORT_MAX')
    .trim()
    .split(' ')
    .map(Number)
  return { min, max }
}

describe('production, with no environment named', () => {
  it('uses production’s folder, process name, port, settings, data and media', () => {
    expect(values()).toEqual({
      ENVIRONMENT: 'production',
      APP_DIR: PRODUCTION,
      APP_NAME: 'sprecher-east',
      APP_PORT: '3000',
      ENV_FILE: `${PRODUCTION}/.env.local`,
      DATA_DIR: `${PRODUCTION}/data`,
      MEDIA_DIR: `${PRODUCTION}/public/media`,
      CADDY_SITE_FILE: '/etc/caddy/Caddyfile',
      KEEP_RELEASES: '3',
      SITE_URL: '',
    })
  })

  it('keeps the PM2 settings it always had', () => {
    const app = pm2App()
    expect(app.name).toBe('sprecher-east')
    expect(app.cwd).toBe(`${PRODUCTION}/current`)
    expect(app.args).toBe('start -H 127.0.0.1')
    expect(app.env).toEqual({ NODE_ENV: 'production', PORT: 3000 })
    expect(app.out_file).toBe('/var/log/pm2/sprecher-east-out.log')
    expect(app.error_file).toBe('/var/log/pm2/sprecher-east-error.log')
  })

  it('writes its PM2 logs where environment.sh says, and a hand start with nothing set agrees (#1346)', () => {
    const defined = printed({}, 'echo "$PRODUCTION_PM2_LOG_DIR"').trim()
    expect(defined).toBe('/var/log/pm2')
    expect(printed({}, 'echo "$PM2_LOG_DIR"').trim()).toBe(defined)
    // started by hand, with no environment at all
    const bare = JSON.parse(
      execFileSync('node', ['-e', APP_OF], { env: { PATH: process.env.PATH }, encoding: 'utf8' }),
    )
    expect(bare.out_file).toBe(`${defined}/sprecher-east-out.log`)
    expect(bare.error_file).toBe(`${defined}/sprecher-east-error.log`)
  })

  it('port_is_free can ask about another host, and says a listening one is not free', async () => {
    const net = await import('node:net')
    const server = net.createServer((s) => s.end())
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
    const port = String(server.address().port)
    try {
      const ask = (args) => run({}, `port_is_free ${args}`).status
      expect(ask(port)).toBe(1)
      expect(ask(`${port} 127.0.0.1`)).toBe(1)
      // a host nothing listens on: free (127.0.0.2 reaches the machine, not this server's address)
      expect(ask(`${port} 127.0.0.2`)).toBe(0)
    } finally {
      await new Promise((resolve) => server.close(resolve))
    }
  })

  it('still lets a test (or the server) move the folder, port and Caddyfile', () => {
    const v = values({ APP_DIR: '/tmp/app', APP_PORT: '3999', KEEP_RELEASES: '5' })
    expect(v).toMatchObject({
      APP_DIR: '/tmp/app',
      ENV_FILE: '/tmp/app/.env.local',
      APP_PORT: '3999',
      KEEP_RELEASES: '5',
    })
    expect(values({ CADDYFILE: '/tmp/Caddyfile' }).CADDY_SITE_FILE).toBe('/tmp/Caddyfile')
  })
})

describe('a pull request preview', () => {
  const env = { PREVIEW_NUMBER: '42' }

  it('uses its own folder, process name, port, settings, data and media, and Caddy block', () => {
    const v = values(env)
    expect(v).toMatchObject({
      ENVIRONMENT: 'preview-42',
      APP_DIR: '/var/www/sprecher-east-previews/pr-42',
      APP_NAME: 'sprecher-east-pr-42',
      ENV_FILE: '/var/www/sprecher-east-previews/pr-42/.env.local',
      DATA_DIR: '/var/www/sprecher-east-previews/pr-42/data',
      MEDIA_DIR: '/var/www/sprecher-east-previews/pr-42/public/media',
      CADDY_SITE_FILE: '/etc/caddy/previews/pr-42.caddy',
      SITE_URL: 'https://pr-42.dev.sprechereast.com',
      KEEP_RELEASES: '2',
    })
    for (const name of ['APP_DIR', 'ENV_FILE', 'DATA_DIR', 'MEDIA_DIR'])
      expect(`${v[name]}/`.startsWith(`${PRODUCTION}/`)).toBe(false)
  })

  it('starts under PM2 with its own name, port, folder and logs', () => {
    const app = pm2App(env)
    const { min, max } = range()
    expect(app.name).toBe('sprecher-east-pr-42')
    expect(app.cwd).toBe('/var/www/sprecher-east-previews/pr-42/current')
    expect(app.env.PORT).toBe(Number(values(env).APP_PORT))
    expect(app.env.PORT).toBeGreaterThanOrEqual(min)
    expect(app.env.PORT).toBeLessThanOrEqual(max)
    expect(app.args).toBe('start -H 127.0.0.1')
    expect(app.out_file).toBe('/var/www/sprecher-east-previews/pr-42/sprecher-east-pr-42-out.log')
    expect(app.error_file).toBe(
      '/var/www/sprecher-east-previews/pr-42/sprecher-east-pr-42-error.log',
    )
  })

  it('keeps its logs in its own folder, never in production’s log folder (#1346)', () => {
    expect(printed(env, 'echo "$PM2_LOG_DIR"').trim()).toBe('/var/www/sprecher-east-previews/pr-42')
    expect(printed(env, 'echo "$PRODUCTION_PM2_LOG_DIR"').trim()).toBe('/var/log/pm2')
  })

  it('takes nothing from a caller that names production’s values', () => {
    const v = values({
      ...env,
      APP_DIR: PRODUCTION,
      APP_NAME: 'sprecher-east',
      APP_PORT: '3000',
      SITE_URL: 'https://sprechereast.com',
      CADDY_SITE_FILE: '/etc/caddy/Caddyfile',
    })
    expect(v).toMatchObject({
      APP_DIR: '/var/www/sprecher-east-previews/pr-42',
      APP_NAME: 'sprecher-east-pr-42',
      SITE_URL: 'https://pr-42.dev.sprechereast.com',
      CADDY_SITE_FILE: '/etc/caddy/previews/pr-42.caddy',
    })
    expect(v.APP_PORT).not.toBe('3000')
  })

  it('moves with the preview root and domain when those are set', () => {
    const v = values({ ...env, PREVIEW_ROOT: '/srv/previews', PREVIEW_DOMAIN: 'dev.example.org' })
    expect(v).toMatchObject({
      APP_DIR: '/srv/previews/pr-42',
      SITE_URL: 'https://pr-42.dev.example.org',
    })
  })

  it('gives two previews different ports, all inside a range that excludes production and Umami', () => {
    const { min, max } = range()
    expect(min).toBeGreaterThan(Math.max(3000, umamiPort()))
    const size = max - min + 1
    const ports = printed(
      {},
      `for n in $(seq 1 ${size}); do (PREVIEW_NUMBER=$n . "${OPS}/environment.sh"; echo $APP_PORT); done`,
    )
      .trim()
      .split('\n')
      .map(Number)
    for (const port of ports) {
      expect(port).toBeGreaterThanOrEqual(min)
      expect(port).toBeLessThanOrEqual(max)
    }
    const seen = new Set(ports)
    expect(seen.size).toBe(max - min + 1)
    expect(values({ PREVIEW_NUMBER: '7' }).APP_PORT).not.toBe(
      values({ PREVIEW_NUMBER: '8' }).APP_PORT,
    )
  }, 60000)

  it.each(['0', '007', 'abc', '12;touch x', '-3', '1234567', ' 5', '5 ', '4.2'])(
    'refuses %j as a pull request number, without printing it',
    (number) => {
      const r = run({ PREVIEW_NUMBER: number }, 'echo reached')
      expect(r.status).not.toBe(0)
      expect(r.stdout).not.toContain('reached')
      expect(r.stdout).toContain(
        '::error title=Server::PREVIEW_NUMBER is not a pull request number',
      )
      expect(r.stdout + r.stderr).not.toContain(number.trim() || 'never')
    },
  )

  it.each(['', 'a b', 'x.com/../y', '-dev.example.org', 'dev.example.org;ls'])(
    'refuses %j as the preview domain',
    (domain) => {
      const r = run({ PREVIEW_NUMBER: '42', PREVIEW_DOMAIN: domain || '$' }, 'echo reached')
      expect(r.status).not.toBe(0)
      expect(r.stdout).toContain('::error title=Server::PREVIEW_DOMAIN is not a host name')
    },
  )

  it.each([
    PRODUCTION,
    `${PRODUCTION}/`,
    `${PRODUCTION}/previews`,
    'previews',
    '/',
    '/var/www//sprecher-east',
    '/var/www/./sprecher-east',
    '//var/www/sprecher-east/x',
    '/var/www/other/../sprecher-east/x',
  ])(
    'refuses %j as the preview root, so a preview can never sit in production’s folder',
    (root) => {
      const r = run({ PREVIEW_NUMBER: '42', PREVIEW_ROOT: root }, 'echo reached')
      expect(r.status).not.toBe(0)
      expect(r.stdout).not.toContain('reached')
      expect(r.stdout).toContain('::error title=Server::')
    },
  )
})

describe('a preview root that reaches production through a link', () => {
  it('is refused, even when production’s folder does not exist here', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'root-'))
    try {
      fs.symlinkSync(PRODUCTION, path.join(dir, 'link'))
      const r = run({ PREVIEW_NUMBER: '42', PREVIEW_ROOT: path.join(dir, 'link') }, 'echo reached')
      expect(r.status).not.toBe(0)
      expect(r.stdout).not.toContain('reached')
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })

  it('and an untidy root outside production is cleaned up before use', () => {
    expect(values({ PREVIEW_NUMBER: '42', PREVIEW_ROOT: '/srv//previews/./x/' }).APP_DIR).toBe(
      '/srv/previews/x/pr-42',
    )
  })
})

describe('the preview port range', () => {
  it.each([
    ['03200', '3999'],
    ['3200', '03999'],
    ['3200', '65536'],
    ['0', '3999'],
    ['3999', '3200'],
    ['2900', '3100'],
    ['3000', '3500'],
    ['3100', '3500'],
    ['2000', '4000'],
    ['3200', 'abc'],
  ])('refuses %s to %s, without computing a port from it', (min, max) => {
    const r = run(
      { PREVIEW_NUMBER: '7', PREVIEW_PORT_MIN: min, PREVIEW_PORT_MAX: max },
      'echo reached',
    )
    expect(r.status).not.toBe(0)
    expect(r.stdout).not.toContain('reached')
    expect(r.stdout).toContain('::error title=Server::the preview port')
  })

  it('keeps production’s and Umami’s ports out, as their own files have them', () => {
    const reserved = printed({}, 'echo $RESERVED_PORTS').trim().split(' ').map(Number)
    expect(reserved).toContain(umamiPort())
    expect(reserved).toContain(pm2App().env.PORT)
  })
})

describe('the most previews at once (#1345)', () => {
  it('is ten by default, and only a number from 1 to 999 is taken', () => {
    expect(printed({}, 'echo $PREVIEW_MAX_COUNT').trim()).toBe('10')
    expect(
      printed({ PREVIEW_NUMBER: '7', PREVIEW_MAX_COUNT: '999' }, 'echo $PREVIEW_MAX_COUNT').trim(),
    ).toBe('999')
    for (const bad of ['0', '01', '1000', '-1', 'abc', '5 6', '']) {
      const r = run({ PREVIEW_NUMBER: '7', PREVIEW_MAX_COUNT: bad }, 'echo reached')
      // an empty value falls back to the default, every other bad one stops the script
      if (bad === '') expect(r.stdout.trim()).toBe('reached')
      else {
        expect(r.status, bad).not.toBe(0)
        expect(r.stdout).toContain('::error title=Server::PREVIEW_MAX_COUNT')
      }
    }
  })
})

describe('ecosystem.config.cjs', () => {
  it('has, with nothing set, the values environment.sh gives production', () => {
    const v = values()
    const app = pm2App()
    expect(app.name).toBe(v.APP_NAME)
    expect(String(app.env.PORT)).toBe(v.APP_PORT)
    expect(app.cwd).toBe(`${v.APP_DIR}/current`)
  })

  it.each([{ APP_NAME: 'x' }, { APP_PORT: '3300' }, { APP_DIR: '/tmp/x' }])(
    'refuses a start with only some of its values set (%j)',
    (env) => {
      const r = spawnSync('node', ['-e', `require(${JSON.stringify(ECOSYSTEM)})`], {
        env: { PATH: process.env.PATH, ...env },
        encoding: 'utf8',
      })
      expect(r.status).not.toBe(0)
      expect(r.stderr).toContain('must be set together')
    },
  )
})
