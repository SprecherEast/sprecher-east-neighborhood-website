# Server operations

Scripts the deploy workflow (`.github/workflows/deploy.yml`) runs on the GitHub Actions runner and
on the VPS. Nothing here is run by hand during a normal deploy. Changes to the server still follow
`AGENTS.md`: an `infra` issue first, then a pull request.

| Script              | Where  | What it does                                                                                                                                                                  | Issue      |
| ------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| `server-facts.sh`   | VPS    | Prints the server's Node version, its public `NEXT_PUBLIC_*` settings and the live commit, for the build                                                                      | #245       |
| `build-release.sh`  | runner | Builds a release in the folder it will run from on the server, with the server's Node and settings, and packs it                                                              | #245       |
| `deploy-release.sh` | VPS    | Checks the release, links the shared files, backs up, migrates, switches `current`, checks the site and switches back if it fails                                             | #245       |
| `rollback.sh`       | VPS    | By hand: puts an earlier release back live                                                                                                                                    | #245       |
| `backup.sh`         | VPS    | Archives the database, uploaded media and `.env.local`; keeps 7 daily, 5 weekly, 5 pre-deploy                                                                                 | #148       |
| `backup-db.mjs`     | VPS    | Copies the live SQLite database with `VACUUM INTO` and checks the copy                                                                                                        | #148       |
| `install-cron.sh`   | VPS    | Installs the daily backup job (08:15 UTC) in `/etc/cron.d/sprecher-east-backup`                                                                                               | #148       |
| `restart-app.sh`    | VPS    | Reloads the app under PM2; starts it fresh, with a way back, when its start settings change. Listens on `127.0.0.1:3000` only. Deletes old sitemap files                      | #118, #267 |
| `caddy-limits.sh`   | VPS    | Caps request bodies on the public form endpoints and `/api/mcp` at Caddy (`caddy/form-limits.caddy`)                                                                          | #124       |
| `caddy-https.sh`    | VPS    | Sends HSTS on the domain (`caddy/hsts.caddy`), and adds a redirect to HTTPS in the plain-HTTP site blocks                                                                     | #235       |
| `install-umami.sh`  | VPS    | Installs and updates Umami analytics in Docker, replaces its default admin password, then opens its own address (helpers: `umami-lib.sh`, `umami-caddy.sh`, `umami-admin.sh`) | #948       |
| `backup-umami.sh`   | VPS    | Dumps Umami's Postgres database; run after the daily backup and before an Umami update                                                                                        | #948       |
| `lib.sh`            | VPS    | Shared helpers: annotations, reading non-secret settings, checking the site through Caddy, the `current` link                                                                 |            |

The scripts print `::notice` and `::warning` lines, which appear as annotations on the deploy run
whether it succeeds or fails, so the result can be read without opening the logs. The deploy log
is public, so the scripts never print secrets or file contents. The site address they check comes
from `NEXT_PUBLIC_SERVER_URL` in `.env.local`, and the check goes to Caddy on the server itself.

## How a deploy runs

CI calls the deploy once its `Type-check & Build` job passes on a push to `main`. It can also be
started by hand (Actions → Deploy to VPS → Run workflow, on `main`).

1. **Preflight** waits until the required checks (`Type-check & Build`, `Prettier`, `ESLint`,
   `Dependency Audit`, `Knowledge sync`, `Agent context`) have passed on the commit, then reads
   the server's facts over SSH. A check that is missing or skipped stops the deploy. `PR Policy`
   runs on pull requests only and the end-to-end tests are not required yet, so the deploy does not
   wait for them. It also stops the deploy when the server's `.env.local` lacks either Turnstile
   key (the robot check on the contact form and sign-up, #869): the `::error` says how to fix it.
   The visible opt-out is the repository variable `ALLOW_NO_ROBOT_CHECK` set to `true` (Settings →
   Secrets and variables → Actions → Variables); the deploy then goes out without the check and
   shows a `::warning` on its run every time. Setting that variable is the owner's decision alone:
   an agent asks him (label `needs owner`) and records the change on an `infra` issue first. The
   gate runs before the docs-only skip, so a docs-only push also fails while keys are missing and
   no opt-out is set. Only the keys' presence is checked, not that
   Cloudflare accepts them (`.github/scripts/robot-check-gate.sh`). It skips
   the deploy when that commit, or a newer one, is already live, or when only docs and repo
   tooling changed since the live commit.
2. **Build release** runs on Ubuntu 24.04 with the server's exact Node version, without any
   secret. It builds in `/var/www/sprecher-east/releases/<commit>`, the folder the release will run
   from, so the paths the build writes are right on the server. The build gets only the public
   `NEXT_PUBLIC_*` values from the server's `.env.local`, a throwaway database and placeholders.
   Production `node_modules` ship with it; their native parts (sharp, libsql) are prebuilt for
   Linux x64 and load on any Node of the same version.
3. **Deploy** uploads the archive into `releases/.incoming-<commit>`, renames it, and runs
   `deploy-release.sh` from the release:
   - checks the release was built with this server's Node and settings, and that its native
     modules load
   - links `.env.local`, `data/` and `public/media` from `/var/www/sprecher-east` into it
   - backs up (`backup.sh pre-deploy`) and runs `payload migrate`, while the live release serves
   - drops the pages prerendered in CI (their database was empty); each page renders from the
     live database on its first visit and is cached from then on
   - switches `current` to the release in one step and reloads PM2 (`restart-app.sh`)
   - checks the home page answers 200 through Caddy and `/api/version` reports the new build; if
     not, switches `current` back and reloads
   - then installs the backup job, applies the Caddy limits and HTTPS settings, installs or
     updates Umami (below), and keeps the newest 3 releases
     (a release that failed is the first to go)

Until the switch, a failure stops the deploy and the live release keeps serving. The reload is the
only moment the site is unavailable: the few seconds Next takes to start.

## Releases

```text
/var/www/sprecher-east/
  .env.local, data/, public/media/   shared by every release, never replaced by a deploy
  releases/<commit>/                 one build each: code, .next, node_modules, .release-info
  current -> releases/<commit>       the live one; PM2 runs the app from here
  src/, .next/, node_modules/, …     the old checkout, from before #245 (see below)
```

`.release-info` in each release says which commit, Node version and public settings it was built
with. `readlink /var/www/sprecher-east/current` shows the live one.

**Moving to releases (the first deploy after #245).** Nothing is moved: the shared files stay
where they are, and the first deploy only adds `releases/` and `current`, then restarts PM2 from
`current` instead of the checkout. If the new release doesn't answer, `restart-app.sh` restarts
PM2 from the checkout again and `current` is removed. The checkout is left as it was, as the way
back, until a later cleanup removes it.

## Roll back

- **Automatic:** a deploy whose release doesn't answer switches back by itself (see above).
- **To an earlier release:** run the copy of `rollback.sh` in the release to go back to, as root:

  ```bash
  ls -lt /var/www/sprecher-east/releases            # newest first
  bash /var/www/sprecher-east/releases/<commit>/ops/rollback.sh
  ```

  It drops that release's cached pages, switches `current`, reloads, and checks it answers with
  its build; if not, the release that was live comes back. The database stays as it is: if the
  newer release ran a migration the older code can't read, restore the pre-deploy backup too
  (below). The next deploy to `main` replaces it again, so revert the bad change in a PR.

- **Back to the old checkout** (undoing the move to releases), as root:

  ```bash
  cd /var/www/sprecher-east
  pm2 delete sprecher-east
  pm2 start ecosystem.config.cjs --only sprecher-east    # the checkout's own copy: cwd is the checkout
  pm2 save
  rm current
  bash ops/install-cron.sh                               # the backup job runs the checkout's script again
  ```

  Then revert #245's pull request, so the next deploy works the old way.

## Caddy request limits

`caddy-limits.sh` copies `caddy/form-limits.caddy` to `/etc/caddy/sprecher-east-form-limits.caddy`
and adds one line, `import /etc/caddy/sprecher-east-form-limits.caddy`, to each site block in
`/etc/caddy/Caddyfile` that proxies to the app. It changes nothing else in the Caddyfile and
leaves it untouched if it can't read the layout safely. Before saving it validates the new config
and backs up the old one (`Caddyfile.bak` and a dated `Caddyfile.bak-<time>`); if Caddy won't
reload or the site stops answering, it puts the backup back.

To change the limit, edit `caddy/form-limits.caddy` in a pull request. To remove it, revert the
pull request that added it (#152), then on the server delete the `import` lines and run
`caddy validate --config /etc/caddy/Caddyfile && systemctl reload caddy`. Removing the lines
without the revert doesn't last: the next deploy adds them back.

## Caddy HTTPS: HSTS and the IP redirect

`caddy-https.sh` only adds lines to `/etc/caddy/Caddyfile`, and refuses any other change:

- **HSTS.** It copies `caddy/hsts.caddy` to `/etc/caddy/sprecher-east-hsts.caddy` and adds
  `import /etc/caddy/sprecher-east-hsts.caddy` to the HTTPS site block for the domain (the host of
  `NEXT_PUBLIC_SERVER_URL`). `www` only redirects, so it gets none. No `includeSubDomains`, no
  `preload`.
- **Plain HTTP.** Each site block that serves plain HTTP, for the IP (`:80`, `http://<IP>`,
  `[::]:80`) or for the domain (`http://<domain>`, `<domain>:80`), gets
  `redir https://<domain>{uri} 308` as its first line. Caddy's default directive order runs
  `redir` before `reverse_proxy`, so the request is answered with the redirect and never reaches
  the app; the `reverse_proxy` line stays where it was. A global `order` option could change that
  order, so a Caddyfile with one is left alone. A plain-HTTP block whose addresses are other hosts
  (such as `http://srv1371281.hstgr.cloud`, alone or next to the IP) gets the redirect too when it
  proxies to the app: `reverse_proxy localhost:3000`, or the block form with a `to` line naming
  it. A plain-HTTP block for another site that doesn't proxy to the app is left as it is. When
  the script can't tell, because the block's `reverse_proxy` points somewhere else (a placeholder,
  say) or it imports a file the script can't see into, it changes nothing and fails the deploy:
  that block may serve sign-in over plain HTTP, and its host can't be checked from here (#338).

It leaves the Caddyfile alone when it can't read the layout safely (a heredoc, a site block on one
line, unbalanced braces), when a block mixes the domain with other addresses (on one line or
several), when a block that proxies to the app serves plain HTTP and HTTPS together, or when the
Caddyfile sets `order`. Then it still checks plain HTTP to the IP: if that reaches the app, the
deploy fails and says why, so the redirect can be added by hand.

"Reaches the app" means the app answers `/api/version` with a build ID. A redirect, no answer, or
Caddy's own empty 200 for a host no site serves doesn't count.

Before changing anything it writes the backups (`Caddyfile.bak` and `Caddyfile.bak-<time>`) under a
temporary name, compares them with the live file and only then renames them, so a backup cut short
by a full disk is never used. It validates the new Caddyfile, replaces it in one rename and
reloads. It then checks that the domain sends the header and that plain HTTP to the domain and to
the IP redirects permanently to the same path on HTTPS. If not, or if anything fails while it
changes the files, it puts back only what it replaced, and the deploy fails. The same check runs
when nothing needed changing. The deploy logs the `curl -I` results as annotations, from the
server and from the internet; the check from the internet runs even when the step before it
failed.

**Reading a failure without SSH (#338).** When the check fails, one annotation, "Caddy HTTPS
details", holds everything needed to tell why:

- every site block as the script read it: its addresses, what it took the block for, whether it
  proxies to the app, and the line it added (`import`, `redir` or none)
- the IP request: host and port, the status and `Location`, and whether the app answered
- how Caddy itself reads the Caddyfile that was checked (`caddy adapt`, cut down to each server's
  listen addresses and, per route, its host matchers and the handlers in order). It shows
  handler names, hosts and upstream addresses only, never header values or other options.

On success, one "Caddy HTTPS evidence" annotation holds the `curl -I` results and the same list of
site blocks.

**A failed HTTPS step turns the deploy red, on purpose.** By then the release is live and
serving, the Caddy change has been rolled back, and the annotation says so. The step stays red
because a rolled-back change means plain HTTP to the IP may still reach sign-in and admin: that's
the gap the owner asked to close (#235). A green run would hide it until someone happened to read
a warning. Each later deploy retries it, so the red goes away as soon as the fix is in.

**Rollout.** The max-age is the one value in `caddy/hsts.caddy`: 300 (5 minutes) first, then
86400 (1 day), then 31536000 (1 year, now), each after a day without problems, each a one-line
pull request. **To undo HSTS,** set `max-age=0` in that file and keep it for at least the longest
max-age that was live, so browsers forget the rule. Removing the import alone leaves browsers
following it until it expires. **To undo the IP redirect,** revert the pull request that added
it, then on the server delete the `redir https://<domain>{uri} 308` lines and run
`caddy validate --config /etc/caddy/Caddyfile && systemctl reload caddy`. Deleting them without
the revert doesn't last: the next deploy adds them back.

## Umami analytics

`install-umami.sh` installs and updates Umami (visit statistics) at its own address, and never leaves
it public with its default admin password. How it works, the order of its steps, backups, restore
and roll back: [`umami/README.md`](umami/README.md).

## Backups

Archives are in `/var/backups/sprecher-east/{daily,weekly,pre-deploy,manual}/`, readable by root
only. Each one holds `payload.db`, `env.local` and the `media/` folder. Hostinger's weekly
whole-server backups (hPanel → VPS → Backups & Monitoring) include this folder, so a copy also
exists off the machine.

- Daily at 08:15 UTC, kept 7 days; Sunday's is also kept as a weekly, 5 weeks.
- Before every deploy, the 5 most recent kept.
- By hand, never deleted automatically: `sudo bash /var/www/sprecher-east/current/ops/backup.sh manual`.
  Delete old ones yourself.

A run refuses to start unless the disk has room for the copy plus 1 GB to spare, so a backup
never fills the disk the live site writes to. The daily job logs to
`/var/log/sprecher-east-backup.log`; each deploy reports the newest daily archive.

## Restore content from an archive

Run on the VPS as root. This replaces the site's current content with the archive's.

```bash
cd /var/www/sprecher-east
bash current/ops/backup.sh manual         # keep a copy of what you are about to replace
mkdir -p /root/restore && tar -C /root/restore -xzf /var/backups/sprecher-east/daily/<archive>.tar.gz
pm2 stop sprecher-east
cp /root/restore/payload.db data/payload.db
rm -f data/payload.db-wal data/payload.db-shm data/payload.db-journal
# Only if media should be restored too: keep the current folder aside, then copy the archive's.
mv public/media public/media.before-restore && cp -a /root/restore/media public/media
(cd current && npx payload migrate)       # brings an older archive up to the current schema
pm2 start sprecher-east
rm -rf /root/restore                      # it holds a copy of .env.local
```

Until the database has an account, the first one created becomes an admin: Payload's first registration at `/admin` does it. So if the restore left `users` empty, register the owner's account there right away. The public sign-up always makes guests.

Then open the site and Admin, and check the restored content. `env.local` in the archive is there
for reference if the server's `.env.local` was lost; copy values back by hand. Once the restore
looks right, delete `public/media.before-restore`.
