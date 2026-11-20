// Production unless the deploy scripts name a pull request preview: ops/environment.sh sets these
// (#1073), and a start by hand with none of them set is production's.
// All three come together or none do: a half-set environment would mix production's values with a
// preview's, so it stops here instead.
const { APP_NAME, APP_PORT, APP_DIR } = process.env
if ([APP_NAME, APP_PORT, APP_DIR].some(Boolean) && ![APP_NAME, APP_PORT, APP_DIR].every(Boolean)) {
  throw new Error('APP_NAME, APP_PORT and APP_DIR must be set together (ops/environment.sh)')
}
const name = APP_NAME || 'sprecher-east'
const port = Number(APP_PORT || 3000)
const appDir = APP_DIR || '/var/www/sprecher-east'

/** @type {import('pm2').ProcessDescription} */
module.exports = {
  apps: [
    {
      name,
      script: 'node_modules/.bin/next',
      // Listen on loopback only: the internet reaches the app through Caddy, never directly (#118).
      args: 'start -H 127.0.0.1',
      // The live release: a link the deploy switches to each new build (#245, ops/README.md)
      cwd: `${appDir}/current`,
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      env: {
        NODE_ENV: 'production',
        PORT: port,
      },
      // Auto-restart on crash
      autorestart: true,
      max_restarts: 10,
      restart_delay: 3000,
      // Logs
      out_file: `/var/log/pm2/${name}-out.log`,
      error_file: `/var/log/pm2/${name}-error.log`,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    },
  ],
}
