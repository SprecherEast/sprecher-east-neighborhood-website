// Production unless the deploy scripts name a pull request preview: ops/environment.sh sets these
// (#1073), and a start by hand with none of them set is production's.
const name = process.env.APP_NAME || 'sprecher-east'
const port = Number(process.env.APP_PORT || 3000)
const appDir = process.env.APP_DIR || '/var/www/sprecher-east'

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
