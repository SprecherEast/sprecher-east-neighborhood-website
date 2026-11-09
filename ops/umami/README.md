# Umami analytics

Visit statistics for the site (#948), installed and kept current by the deploy. Umami and its
Postgres database run from `compose.yaml` in `/var/www/umami`. Umami is published on `127.0.0.1` only
(port 3100, defined in `ops/umami-lib.sh`); the database is not published at all. Caddy is the
only public way in, at `stats.<domain>`: the prebuilt image can't run under a path (`BASE_PATH` is
fixed when the image is built). `DISABLE_TELEMETRY` and `DISABLE_UPDATES` are on, `MCP_ENABLED` is
left off (#951), `CLIENT_IP_HEADER` is `x-forwarded-for` (Caddy sets it, so a visitor can't fake
their address), both containers have a memory cap (below), and the image is pinned to a version (a bump is a one-line pull request; tags:
`ghcr.io/umami-software/umami`).

## The scripts

| File                                       | What it does                                                                                 |
| ------------------------------------------ | -------------------------------------------------------------------------------------------- |
| `install-umami.sh`                         | The steps below; run by `deploy-release.sh` after the Caddy scripts                          |
| `umami-lib.sh`                             | Shared definitions: the folder, the port, the Caddy route file, how to run compose           |
| `umami-caddy.sh`                           | Opens and closes the public address (one route file, one `import` line in the Caddyfile)     |
| `umami-admin.sh`                           | Logs in and changes the admin password through Umami's API                                   |
| `backup-umami.sh`                          | Dumps the database and copies `.env`                                                         |
| `umami/compose.yaml`, `caddy/umami*.caddy` | The containers; the proxy block; the closed block (503) that stands in while it must be shut |

`/var/www/umami/.env` (root only, never in the repository or the log) holds the generated database
password, `APP_SECRET` and two-factor key, and is kept between deploys.

## What a deploy does

The admin password is the GitHub secret `UMAMI_ADMIN_PASSWORD`, sent over the SSH session's stdin
(`deploy-release.sh --umami-password-stdin`), never as an argument or a file. Every step is an
annotation, and none holds a secret value.

0. **Closes first.** Unless both the Umami container and its database container are running (a running
   database alone doesn't count, and neither does Umami alone), and when the route file exists or the
   Caddyfile still imports it, the route file Caddy serves becomes a closed block (503) and Caddy is
   reloaded, before anything else and whatever happens next, even when a skip below ends the run. The
   one exception is the first skip: a `NEXT_PUBLIC_SERVER_URL` that gives no usable domain ends the run
   before this step, because the address can't be named. It reloads even if the file already was the
   closed block, doesn't depend on the import line's spacing or a trailing comment, and keeps the
   closed block on disk even when Caddy would not reload. A database that came back empty has Umami's
   default admin password, so nothing may be public while Umami might start with it.
1. **Skips** (`::notice`, the deploy still succeeds) while the secret or the DNS name `stats.<domain>`
   is missing (#949 on a first install; on a server that has Umami, a DNS lookup that fails once says
   so without blaming it). **Skips with a warning** for a password under 12 characters or when Docker
   is missing. **Refuses with a warning** when under 1 GB of memory is available and Umami isn't
   running, or on a first install when under 2 GB of disk is free where Docker keeps its images.
2. A first install relies on the deploy's own `backup.sh pre-deploy`. Later runs dump Umami's database
   first, when its database container runs.
3. Writes the settings, starts the containers and waits up to 2 minutes for `/api/heartbeat`.
4. Logs in as `admin`. With the secret's password it is done (a login that asks for the two-factor code
   counts: the password was right). With Umami's documented default it changes the password
   (`POST /api/me/password`). With neither, someone changed it in Umami and it is left. Then the
   default must be rejected (401). Any other answer closes the address, fails the deploy and says so.
5. Only then does it put the proxy back, add `import /etc/caddy/sprecher-east-umami.caddy` to the end
   of the Caddyfile if it isn't there (backed up as `Caddyfile.bak-umami-<time>`, validated first;
   a failed reload restores both), and check that `https://stats.<domain>` answers and rejects the
   default password. No answer within a minute is a warning (the certificate may still be coming).

A failure from step 3 on turns the deploy red with the address closed and the Umami container stopped until the next deploy (even an update of a Umami that was serving); `compose up`, with the image pulls, gets 10 minutes; the site is already live and
unaffected. Port 3100 is also checked from outside on every deploy.

**Memory caps.** `mem_limit` is 768 MB for Umami and 512 MB for Postgres, so the two stay under about
1.25 GB of the server's 4 GB while the site's Node process and the system keep the rest. No figure for
these comes from Umami's documentation: they follow the roughly 1 GB the issue (#948) estimated, with
some headroom. A container that goes over is killed and restarted by Docker (`restart:
unless-stopped`) inside its own limit, so a leak in Umami can't make the kernel pick the site's
process. Raise a limit in `compose.yaml` if the logs show repeated restarts.

**Changing the admin password.** Change it in Umami first, then the GitHub secret. Changing only the
secret does nothing: once the password is no longer the default, the script leaves it as it is.

## Backups

The daily job (`install-cron.sh`) runs `backup-umami.sh daily` after the site's backup:
`/var/backups/sprecher-east/umami/umami-daily-<time>.sql.gz` and a copy of `.env` beside it (7 kept;
pre-deploy dumps before an update, 5). Keep the `.env` copy with the dump: without the two-factor
key a restored dump can't decrypt the stored two-factor secrets.

## Roll back and restore

- **Stop it:** in `/var/www/umami`, `docker compose down` (the data stays in the `umami-db-data`
  volume). Revert the pull request; then on the server remove the `import` line and
  `/etc/caddy/sprecher-east-umami.caddy` and reload Caddy. Deleting the volume is a separate,
  deliberate step. (Its full name is `umami_umami-db-data`: the project name, then the volume.) Never start Umami by hand with `docker compose up` (see the next point).
- **Start it only by re-running the deploy** (Actions → Deploy to VPS → Run workflow), which closes
  the address, replaces the default password and only then opens it. Before any start by hand, run
  `bash /var/www/sprecher-east/current/ops/install-umami.sh` with no secret in the environment: it
  closes the address and then skips, because the secret is missing. Without that, a start on an empty
  database would be public on Umami's default admin password.
- **Restore a dump** into an empty database. The address is closed by that script only when Umami and its database are not both running, so check first that Umami is stopped. Every merge deploys,
  and a deploy starts Umami, whose first start would create its own tables in the empty database and
  clash with the restore. So restore while no deploy is running and hold merges until it is done
  (Actions → Deploy to VPS). Restore `.env` from its copy, then in `/var/www/umami`:
  `docker compose down -v` (empties the database), `docker compose up -d db`, then
  `gunzip -c <dump> | docker compose exec -T db sh -c 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"'`
  (it stops at the first error rather than leaving a half-restored database), and finally re-run the
  deploy to start Umami. If a deploy did start Umami first, run `docker compose down -v` and begin
  again.

## The site's tracking script (#950)

The public layout loads `https://stats.<domain>/script.js` after the page, only when
`NEXT_PUBLIC_UMAMI_WEBSITE_ID` is in `/var/www/sprecher-east/.env.local` at build time (the site's
ID from Umami, public). It sets `data-do-not-track`, `data-domains` (the site's address and its bare domain) and
`data-exclude-search`, so a browser that asks not to be tracked, or a copy of the site on another
hostname, counts nothing, and no page address reaches Umami with its query string (reset and
verification tokens, a sign-up email and search words travel there). Umami keeps what it records
until someone deletes it; the Privacy page says so. A malformed ID stops the deploy at the preflight. Caddy proxies every path
of `stats.<domain>`, so `/script.js` and `/api/send` are public, as is the login page; the site has
no Content-Security-Policy that would block either. After adding or changing the ID, redeploy
(Actions → Deploy to VPS → Run workflow).
