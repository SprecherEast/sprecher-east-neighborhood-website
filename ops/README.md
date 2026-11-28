# Server operations

Scripts the deploy workflow (`.github/workflows/deploy.yml`) runs on the GitHub Actions runner and
on the VPS. Nothing here is run by hand during a normal deploy. Changes to the server still follow
`AGENTS.md`: an `infra` issue first, then a pull request.

| Script                       | Where  | What it does                                                                                                                                                                                                                                                                                                                                                                                                            | Issue      |
| ---------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| `server-facts.sh`            | VPS    | Prints the server's Node version, its public `NEXT_PUBLIC_*` settings and the live commit, for the build                                                                                                                                                                                                                                                                                                                | #245       |
| `build-release.sh`           | runner | Builds a release in the folder it will run from on the server, with the server's Node and settings, and packs it                                                                                                                                                                                                                                                                                                        | #245       |
| `deploy-release.sh`          | VPS    | Checks the release, links the shared files, backs up, migrates (once more after a busy database, #1147), switches `current`, checks the site and switches back if it fails                                                                                                                                                                                                                                              | #245       |
| `rollback.sh`                | VPS    | By hand: puts an earlier release back live                                                                                                                                                                                                                                                                                                                                                                              | #245       |
| `backup.sh`                  | VPS    | Archives the database, uploaded media and `.env.local`; keeps 7 daily, 5 weekly, 5 pre-deploy                                                                                                                                                                                                                                                                                                                           | #148       |
| `backup-db.mjs`              | VPS    | Copies the live SQLite database with `VACUUM INTO` and checks the copy                                                                                                                                                                                                                                                                                                                                                  | #148       |
| `install-cron.sh`            | VPS    | Installs the daily backup job (08:15 UTC) in `/etc/cron.d/sprecher-east-backup`                                                                                                                                                                                                                                                                                                                                         | #148       |
| `restart-app.sh`             | VPS    | Reloads the app under PM2; starts it fresh, with a way back, when its start settings change. Listens on its own loopback port only (3000 for production). Deletes old sitemap files                                                                                                                                                                                                                                     | #118, #267 |
| `caddy-limits.sh`            | VPS    | Caps request bodies on the public form endpoints, `/api/mcp` and `/oauth/token`, at Caddy (`caddy/form-limits.caddy`)                                                                                                                                                                                                                                                                                                   | #124       |
| `caddy-https.sh`             | VPS    | Sends HSTS on the domain (`caddy/hsts.caddy`), and adds a redirect to HTTPS in the plain-HTTP site blocks                                                                                                                                                                                                                                                                                                               | #235       |
| `caddy-previews.sh`          | VPS    | Adds one `import` line for the folder of pull request preview site blocks, and installs the preview headers (`caddy/preview-headers.caddy`); see [`previews.md`](previews.md)                                                                                                                                                                                                                                           | #1072      |
| `build-developer-pages.sh`   | runner | Builds the developer pages (the static export of `developer/`) into `developer-site/pages` in the release; optional for production, so a failed build never fails the release; never in a pull request preview; see [the developer site](developer-site.md)                                                                                                                                                             | #1530      |
| `build-showcase.sh`          | runner | Builds the Storybook showcase into a folder of the release (`developer-site/storybook` for production, `public/showcase` for a pull request preview); optional for production, so a failed showcase never fails the release; see [the developer site](developer-site.md)                                                                                                                                                | #1459      |
| `developer-site.sh`          | VPS    | Production deploy only, after the release is live: assembles, checks and publishes the developer site (the developer pages and the Storybook showcase) at `dev.sprechereast.com`; never fails the deploy; see [the developer site](developer-site.md)                                                                                                                                                                   | #1459      |
| `developer-site-check.sh`    | VPS    | Refuses to serve a folder that holds anything but the developer pages and the Storybook showcase: links, other names for a file, hidden or private-by-name files, writable files, too much, or a third-party font host, or pages or a showcase without the site's font files                                                                                                                                            | #1459      |
| `install-umami.sh`           | VPS    | Installs and updates Umami analytics in Docker, replaces its default admin password, then opens its own address (helpers: `umami-lib.sh`, `umami-caddy.sh`, `umami-admin.sh`, `secret-lib.sh`)                                                                                                                                                                                                                          | #948       |
| `backup-umami.sh`            | VPS    | Dumps Umami's Postgres database; run after the daily backup and before an Umami update                                                                                                                                                                                                                                                                                                                                  | #948       |
| `environment.sh`             | VPS    | Defines once what differs between production and a pull request preview (folder, PM2 process, port, settings, data and media, Caddy block, site address); see [`previews.md`](previews.md)                                                                                                                                                                                                                              | #1073      |
| `preview-settings.sh`        | VPS    | Writes a pull request preview's own `.env.local` at its first deploy: random secrets, Cloudflare's Turnstile test keys, no mail, analytics or outside keys; kept on redeploys, never copied from production; see [`previews.md`](previews.md)                                                                                                                                                                           | #1344      |
| `preview-accounts.sh`        | VPS    | Makes a pull request preview's test account passwords on every deploy: one random password per role (`admin`, `editor`, `resident`, `guest`) in a private file (mode 600) in its folder, never printed; the seed reads it; see [`previews.md`](previews.md)                                                                                                                                                             | #1393      |
| `install-preview-access.sh`  | VPS    | Production deploy only: makes the restricted preview account, its root-owned copy of main's preview scripts, one sudo rule and the key line; changes nothing on any doubt; see [Pull request preview account](#pull-request-preview-account)                                                                                                                                                                            | #1345      |
| `preview-wrapper.sh`         | VPS    | The preview key's forced command: only `facts`, `list`, `upload`, `deploy`, `teardown` and `credentials`, every value checked, nothing passed to a shell                                                                                                                                                                                                                                                                | #1345      |
| `preview-caddy.sh`           | VPS    | Run as root through one sudo rule with a pull request number: writes or removes that preview's Caddy block from main's templates, validated, atomic, reloaded or rolled back (a removed block that cannot be put back is kept under a name the import does not read, and the warning names it)                                                                                                                          | #1345      |
| `preview-copy.sh`            | VPS    | Run as root through its own sudo rule with a pull request number: snapshots production's database into a root-only folder (`ops/backup-db.mjs`), runs the export from production's release, hard-links the media the export lists into the preview's staging folder, prints the export's file, and deletes the snapshot at once, also on failure; see [`previews.md`](previews.md#production-content-in-a-preview-1397) | #1397      |
| `preview-isolation-check.sh` | VPS    | Run as the preview account before and after every preview deploy (and before the key line is written): fails when it can open production's settings, database, media, backups, Umami files, PM2 logs, Caddy's storage or the content copy's snapshot folder, change in place a picture its preview shares with production, or connect to Caddy's admin endpoint; the wrapper then takes the preview down                | #1346      |
| `preview-host-guards.sh`     | VPS    | Production deploy only, as root: takes "others" access off production's folders, adds the account to `cron.deny` and `at.deny`, and refuses its connections to Caddy's admin port with an owner-match firewall rule that a boot unit restores; changes nothing on any doubt; see [Pull request preview account](#pull-request-preview-account)                                                                          | #1346      |
| `caddy-lock-lib.sh`          | VPS    | `take_caddy_lock`: one lock, beside the Caddyfile, taken by every script that changes Caddy (`caddy-limits.sh`, `caddy-https.sh`, `caddy-previews.sh`, the Umami route change, `preview-caddy.sh`), so none reloads Caddy in the middle of another's change; closing Umami's address asks for it once, without waiting, and goes on without it when it is held                                                          | #1345      |
| `caddy-block-lib.sh`         | VPS    | `caddy_place_block`, `caddy_restore_block`: one block file moved into the folder Caddy imports, every step checked, the previous block put back whole (`preview-caddy.sh`, `developer-site.sh`)                                                                                                                                                                                                                         | #1459      |
| `releases-lib.sh`            | VPS    | `point_link_at`, `point_current_at`, `prune_releases`: the atomic link switch and the removal of old releases (`deploy-release.sh`, `rollback.sh`, `developer-site.sh`)                                                                                                                                                                                                                                                 | #1459      |
| `preview-access-lib.sh`      | VPS    | `refuse`, the number and commit checks, the check that an unpacked release links nowhere outside itself and the unpacked size of an archive; used by the scripts above                                                                                                                                                                                                                                                  | #1345      |
| `lib.sh`                     | VPS    | Shared helpers: annotations, reading non-secret settings, checking the site through Caddy, the `current` link, and the Caddy import check, reload check and rollback                                                                                                                                                                                                                                                    |            |
| `secret-lib.sh`              | VPS    | Makes one random secret (`openssl rand -hex 32`) and checks its shape, so no script writes an empty or short one; used by `install-umami.sh`, `preview-settings.sh` and `preview-accounts.sh`                                                                                                                                                                                                                           | #1344      |
| `migrate-lib.sh`             | VPS    | `run_migrate`: `payload migrate`, run once more only after `SQLITE_BUSY` before any migration began (sourced by `deploy-release.sh`)                                                                                                                                                                                                                                                                                    | #1147      |

The scripts print `::notice` and `::warning` lines, which appear as annotations on the deploy run
whether it succeeds or fails, so the result can be read without opening the logs. The deploy log
is public, so the scripts never print secrets or file contents. The site address they check comes
from `NEXT_PUBLIC_SERVER_URL` in `.env.local`, and the check goes to Caddy on the server itself.

## Where the deploy secrets live

The secrets the deploy reads (`VPS_HOST`, `VPS_USER`, `VPS_PORT`, `VPS_SSH_KEY`, `VPS_KNOWN_HOSTS`,
`UMAMI_ADMIN_PASSWORD` and `OFFSITE_BACKUP_RCLONE_CONF`) are secrets of the GitHub environment `production` (Settings →
Environments → production). That environment only runs from `main`, so a workflow on any other
branch cannot read them (#1071). A job that names an environment still sees repository secrets, so
they are only out of reach once the repository-level copies of the same names are deleted. Only the jobs that read them, Preflight and
Deploy, name the environment; Build release names none and reads no secret.
`.github/scripts/deploy-secrets-environment.test.mjs` fails when that stops being true.

To change one, open the environment's page and replace its value; GitHub never shows a stored value
again. Changing the deploy key means generating a new pair, adding the public key to the deploy
account's `authorized_keys` on the VPS (after a dated backup of that file), setting `VPS_SSH_KEY`,
and removing the old key line once a deploy has passed. Setting any of them is the owner's job.

## How a deploy runs

CI calls the deploy once its `Type-check & Build` job passes on a push to `main`. When a redeploy is
needed it can also be started by hand on `main`: by the owner (Actions → Deploy to VPS → Run workflow)
or by an agent, within the limits in [`wrapped`](../.agents/skills/wrapped/SKILL.md) step 2, with
`gh api -X POST repos/{owner}/{repo}/actions/workflows/deploy.yml/dispatches -f ref=main -F return_run_details=true`.

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
   Cloudflare accepts them (`.github/scripts/robot-check-gate.sh`). It also stops the deploy
   when `NEXT_PUBLIC_UMAMI_WEBSITE_ID` is set to anything but a UUID (the visit counter's site ID, #950;
   unset is fine and counts nothing; `.github/scripts/umami-id-gate.sh`). It skips
   the deploy when that commit, or a newer one, is already live, or when only docs and repo
   tooling changed since the live commit.
2. **Build release** runs on Ubuntu 24.04 with the server's exact Node version, without any
   secret. It builds in `/var/www/sprecher-east/releases/<commit>`, the folder the release will run
   from, so the paths the build writes are right on the server. The build gets only the public
   `NEXT_PUBLIC_*` values from the server's `.env.local`, a throwaway database and placeholders.
   Production `node_modules` ship with it; their native parts (sharp, libsql) are prebuilt for
   Linux x64 and load on any Node of the same version. It also builds the developer pages and the
   Storybook showcase into the release (`developer-site/pages` and `developer-site/storybook`,
   `ops/build-developer-pages.sh` and `ops/build-showcase.sh`); if either fails the release is
   built without it, with a warning.
3. **Deploy** uploads the archive into `releases/.incoming-<commit>`, renames it, and runs
   `deploy-release.sh` from the release:
   - checks the release was built with this server's Node and settings, and that its native
     modules load
   - links `.env.local`, `data/` and `public/media` from `/var/www/sprecher-east` into it
   - backs up (`backup.sh pre-deploy`) and runs `payload migrate`, while the live release serves.
     The database waits up to 5 s for a lock (`SQLITE_BUSY_TIMEOUT_MS`), and if `payload migrate`
     still fails with `SQLITE_BUSY` before any migration began (no "Migrating:" line in its
     output), `run_migrate` (`migrate-lib.sh`) waits 5 s and runs it once more. A failure once a
     migration has begun is never retried, because the migration may be applied but not recorded
     and would run twice; any other failure, or a second one, stops the deploy with the live site
     unchanged (#1147, #153)
   - drops the pages prerendered in CI (their database was empty); each page renders from the
     live database on its first visit and is cached from then on
   - switches `current` to the release in one step and reloads PM2 (`restart-app.sh`)
   - checks the home page answers 200 through Caddy and `/api/version` reports the new build; if
     not, switches `current` back and reloads
   - then installs the backup job, applies the Caddy limits, HTTPS settings and the preview import,
     publishes the developer site ([`developer-site.md`](developer-site.md); a failure there is a warning and never
     turns the deploy red), installs the preview account (below), installs or updates Umami (below),
     and keeps the newest 3 releases (a release that failed is the first to go)

Until the switch, a failure stops the deploy and the live release keeps serving. The reload is the
only moment the site is unavailable: the few seconds Next takes to start.

## Pull request preview flow

A pull request with the `preview` label (and a change that reaches the server) gets a preview from
`.github/workflows/preview.yml` (#1075): a gate, the server's Node version through the preview account, a build
with no secret, a deploy through the wrapper, and one comment on the pull request that is edited in place
(the link, the short commit, the time, whether it worked). The steps run these scripts, each with its test:

| Script                                | Where  | What it does                                                                                                                                                             |
| ------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `.github/scripts/plan-preview.sh`     | runner | The gate: same-repository, not Dependabot, a change that reaches the server (`deploy-paths.sh`, also read by `plan-deploy.sh`), the label                                |
| `.github/scripts/preview-facts.sh`    | runner | Asks the wrapper's `facts`; no key, or a server that refuses it, means "previews unavailable", once, without a retry                                                     |
| `.github/scripts/preview-deploy.sh`   | runner | Checks the archive's sizes and the cap (`PREVIEW_MAX_COUNT`), then the wrapper's `upload` and `deploy`; reports live, taken down or failed                               |
| `.github/scripts/preview-comment.mjs` | runner | The one comment: fixed texts and checked values, found by a hidden marker and edited in place                                                                            |
| `e2e/previewSeed.ts`                  | VPS    | A preview's first database: one test account per role, with the passwords `preview-accounts.sh` made; run by `deploy-release.sh` after the migrations, before the switch |

The `preview` environment, its key and what happens when either is missing, the jobs that hold the key and the
ones that don't, and what is not covered: [`previews.md`](previews.md#the-workflow-1075). The production deploy's guards and installer also print, on every run, one `Preview host guards: <each folder's
state> | Caddy's own check: <ran as … or not needed or not run: why>` line and one `Preview access: <key state>; host
guards …; isolation check …` line, so the log always shows whether a key is allowed and what the checks said. To read what a
preview deploy did, open the workflow run: the wrapper and the scripts print annotations and no secret. GitHub
shows at most ten notice annotations per step, so the full text is in the step's log.

## Pull request preview account

A pull request preview runs unreviewed code, so its deploy gets its own way in, not production's (#1345,
part 2 of #1074; the owner's decision of 2026-11-11 is recorded on #1074). The production deploy runs
`install-preview-access.sh` from `main`; a preview deploy never does.

- **One account** (`PREVIEW_USER`, default `sprecher-preview`, defined in `environment.sh`) owns the
  previews root (`/var/www/sprecher-east-previews`, with PM2's state in `.pm2`) and runs the preview apps.
  It has no password and no other group. Its **home, `.ssh` and `authorized_keys` are root-owned**, so a
  preview app running as it can't add a key or replace the forced command.
- **The key line** is `restrict,command="<wrapper>" ssh-ed25519 <key>`: no shell, port forwarding, agent
  or terminal, and the wrapper as the only command. The public half is `ops/preview-deploy-key.pub`
  (public, so it is committed, #1385); its private half is the only secret of the GitHub environment `preview`.
  With no key file the file holds no key. Removing the file revokes the key at the next deploy.
- **The wrapper** (`preview-wrapper.sh`, in `/usr/local/lib/sprecher-east-preview/ops/`, root-owned) reads the
  request from `SSH_ORIGINAL_COMMAND`. One line, one of `facts`, `list`, `upload <number> <commit>` (the
  `.tar.gz` release on stdin, at most 1 GiB, no path or link that leaves the release), `deploy <number> <commit>`,
  `teardown <number>` or `credentials <number>` (the preview's test sign-in, only once the seed confirmed it;
  #1394, [handing it out](previews.md#the-workflow-1075)). A number is `^[1-9][0-9]{0,5}$`, a commit 40 lowercase hex digits
  (`environment.sh`); anything else is refused with a fixed message that never repeats the request.
  `deploy` runs main's copy of `deploy-release.sh` (and its settings and restart scripts) on the uploaded
  release, never a script from the release.
- **Production's content** reaches a preview through a second root script (#1397): the same sudo rule file lets the
  account run `preview-copy.sh` too, with a number of 1 to 6 digits and nothing else. It works as the Caddy script
  does (fixed PATH, privileged mode, the shared lock, no environment from the caller) and keeps its snapshot in a
  folder only root can enter (`PREVIEW_COPY_TMP`, made by the installer, mode 700), deleted when the script ends
  (the installer also sweeps what a killed run left). The export is time-limited (`PREVIEW_COPY_SECONDS`).
  What it does and why: [`previews.md`](previews.md#production-content-in-a-preview-1397).
- **Caddy** is never written by the account. One sudo rule (`/etc/sudoers.d/sprecher-east-preview`) lets it run
  `preview-caddy.sh` (and the content copy script above) and nothing else, with a number of 1 to 6 digits matched by sudo itself and checked
  again by the script. The rule sets `secure_path`, and the script starts in bash's privileged mode with a fixed
  PATH and locale before anything runs, so nothing on the caller's PATH is ever run as root. The script
  builds the block from main's copies of `caddy/preview-site.caddy` and `preview-headers.caddy`, has Caddy
  validate it before it is moved into `/etc/caddy/previews/` (under a name the folder's import does not
  match), moves it in with one rename, validates the whole config, reloads, and on any failure puts the
  previous block back and reloads again. A preview with no folder gets its block removed, moved first to a copy under a name the import does not read; if Caddy will not take the config without it and the copy cannot be moved back, the copy is kept there and the warning names it. It takes the shared
  Caddy lock first (`caddy-lock-lib.sh`), and refuses a new block beyond `PREVIEW_MAX_COUNT` (the cap, two: [the cap](previews.md#removal-the-cap-and-the-sweep-1076)), because each block orders a certificate from a
  budget production shares; the wrapper refuses a new preview folder beyond the same number, under a lock so two
  starting together can't both take the last place, and removes the empty folder of a new preview whose upload
  failed.
- **The installer** changes nothing, and says why in a warning, when anything is unexpected: not root, a
  different account of that name, a link or foreign owner on any path it uses, a sudo rule or key file it
  did not write, an sshd that would not take the key line (public keys off, other key files, `AllowGroups`,
  `AllowUsers` or `DenyUsers` that exclude the account, `UsePAM` off, `PermitUserEnvironment`, an `AcceptEnv`
  beyond `LANG` and `LC_*`, an `AuthorizedKeysCommand` or `ForceCommand`), a node or pm2 other accounts can't
  run, a snapshot folder that is open to others, or a tool the root scripts use (`caddy`, `systemctl`, `flock`,
  `stat`, `find`, `df`, `cp`, `ln`, `mktemp`, `chown`, `chmod`, `readlink`, `openssl`, `getent`, `realpath`) missing
  from their PATH. It
  replaces only files that differ, after copying each to `<file>.bak-preview-access-<UTC time>`, checks the
  account really can run the wrapper, is refused anything else and can't write its home, and puts the sudo
  rule back if a check fails (a step that fails, such as a dated copy that can't be made, is a failure, never
  skipped). The key line goes in last, and **only when the host guards and the isolation check below both
  pass** (#1346): before it, the installer runs `preview-host-guards.sh`, then the installed
  `preview-isolation-check.sh` as the account (from `/`). When either fails, no key line is written, and one
  left by an earlier run is taken out (the old file is kept as a dated copy). Both run even when there is no
  key file, so the first deploy's annotations show what the account can reach. Its annotation lists what
  changed and the key's fingerprint, or why there is no key.
- **Read the result** in the deploy's annotations: `Preview access installed` (with the list) or `already in
place`, or `WARNING: preview access was not installed: <reason>; nothing was changed`.
- **Check on the server** (once, after the first deploy with a key file; carried to the issue): from a
  machine with the private key, `ssh <account>@<server> facts` answers, while `ssh ... id`, `ssh ... sh`,
  a port forward (`-L`) and `facts; id` are refused; `sudo -l -U sprecher-preview` lists only the Caddy script.
  Record the results on #1345.
- **The isolation check** (`preview-isolation-check.sh`, #1346) runs as the account: in the wrapper's `deploy`
  before anything is started (a failure refuses the deploy, starts nothing and takes down a preview already running under that number: its process, folder and Caddy block) and again after it, and in the installer before a key line. It fails when the account can enter a folder that should be closed (production's, the backups, Umami's, PM2's
  logs), or open a production file:
  `.env.local`, the database, Umami's `.env`, or any file at all (to eight levels) in production's folder, its
  data and media, the backups, Umami's folder, production's PM2 state and logs, or Caddy's data and certificate
  storage (`CADDY_STORAGE_DIR`); or can connect to `localhost` on Caddy's admin port over IPv4 or IPv6. It
  reports every failure and never a file's content. When the wrapper's check fails after the deploy, the preview is stopped, its
  folder and Caddy block are removed, and the deploy fails with `the isolation check failed, so the preview
was taken down`. Its paths and the admin port are defined once, in `environment.sh`.
- **The host guards** (`preview-host-guards.sh`, run as root by the installer, #1346) make that true, and each
  makes no change on any doubt (a warning says why, and then no key line is written):
  - **Production's folders.** Production's folder, the backups, Umami's folder and PM2's log folder
    (`PRODUCTION_PM2_LOG_DIR`, `/var/log/pm2`) lose "others" access (`chmod o-rwx`; the annotation gives the old
    mode and the undo). The production deploy runs with `umask 022` so what it writes, PM2's logs included, is readable by every account; with the folder closed, the account can't enter it. A folder is
    closed only after the script has checked, and changes nothing with a warning (and no key line) when any of
    it fails: it is a real folder (not a link, and a link that points nowhere counts as one); it and what is
    directly in it are owned by root; `caddy adapt` of the live Caddyfile (read the way `caddy-https.sh` reads
    it) succeeds and names no path in it; no file in the Caddyfile's folder (backups such as `Caddyfile.bak-*`
    and subfolders included) or the previews' folder names the folder's path (a text search, a cheap first
    filter; the warning names the first file found, and a search that can't read everything is a doubt); and no
    process that isn't root's (by its effective user, from `/proc/*/status`) has it as its working folder or an
    open file in it (`/proc/*/cwd`, `/proc/*/fd`). **Then Caddy is the proof of what it reads from the Caddyfile:** from `/`, with a clean environment plus
    the unit's own (`Environment=` and `EnvironmentFile=` of `caddy`; only plain `KEY=value` entries are taken,
    and an entry with quotes, spaces or anything else is a doubt, because systemd reads those differently and a
    wrong value would make root and Caddy's user resolve a placeholder to the same wrong path; the first reason is the one reported. An `EnvironmentFile=` the unit marks optional with `-` (`systemctl show` prints `ignore_errors=yes`) is skipped when it is missing, as systemd does; a required one that is missing, or any file that can't be read, is a doubt. `PassEnvironment=`, `DefaultEnvironment=` and `systemctl set-environment` are not read), `caddy adapt` is run as Caddy's service user (`systemctl show -p User caddy`, then `runuser -u`) and
    must give exactly what root's `adapt` gives, before the change (otherwise nothing is closed) and again after
    every folder is closed; `caddy validate` as that user must pass both times (certificate and log files).
    Comparing output matters: a glob over a folder Caddy's user can't open matches nothing without an error, so
    `validate` alone would pass while files vanish from the configuration. The import forms tested are
    a link beside the Caddyfile, a linked folder, relative paths, globs (also relative and nested), nested files,
    a placeholder and the Caddy folder itself inside a closed folder; a file Caddy's user can't read makes
    `validate` fail, and a glob over a folder it can't open changes the output (the warning says which step
    failed). Other forms are assumed to behave the same, not proven. When the second run differs or fails, every mode changed in that run is put back (a mode that can't
    be is named in the warning), and the modes are also put back if the script is stopped before the second run
    is done. Each old mode is logged before its folder is closed. The whole window is under Caddy's lock (the one
    the Caddy scripts share), so no preview reload runs inside it; if the lock can't be taken, or Caddy's user
    can't be found, is root, or `runuser` is missing, no folder is closed. Why close, check, undo rather than
    check first: the files Caddy's parser opens can't be listed beforehand. **Assumed, not proven:** what Caddy
    opens only while it serves (`validate` opens some of that, not all), that no other non-root service opens a
    file there by name only now and then, and that the real `caddy` and `runuser` behave as the tests' stand-ins
    do: the equality of `adapt` is proven against the stand-ins and is verified on the first production deploy;
    the annotation's undo is the way back. A later named deploy account for production (#1306) must be given group
    access to these folders.
  - **cron and at.** The account is added to `/etc/cron.deny` (made if missing) and `/etc/at.deny` (never
    made: with no at file only root may use `at`, and a new `at.deny` would open it to everyone), with a dated
    copy. It stops when the account is in `cron.allow` or `at.allow`, and checks the result against how cron
    and at read those files.
  - **Caddy's admin endpoint.** An owner-match rule in `iptables` and `ip6tables` (`OUTPUT`, first, `-o lo`,
    TCP, the admin port, the account's user id, `REJECT --reject-with tcp-reset`, comment
    `sprecher-east-preview-caddy-admin`) refuses the account's connections to `localhost`. It is made only
    when root can reach the endpoint on `127.0.0.1` at that port (so it protects something and can be
    checked) and the account exists. A unit, `sprecher-east-preview-firewall.service` (marked, with a dated
    copy of a changed file), runs `preview-host-guards.sh boot` at boot to put the rule back; the next deploy
    enables it if it is not. Why a firewall rule and not a unix socket: the decision on #1346.
- **Read the guards' result** in the annotations: `Preview host guards (...)` with the list of changes,
  `already in place`, or `WARNING: preview host guard not applied: <reason>`; then `Preview isolation` notices
  or errors. **Check on the server** (once, after the first deploy with the guards): `iptables -S OUTPUT` and
  `ip6tables -S OUTPUT` show the rule first; `systemctl is-enabled sprecher-east-preview-firewall`; as the
  account, `curl -m 3 localhost:2019` is refused while as root it answers, and `systemctl reload caddy` still
  works. Record the results on #1346.
- **Disk floor** (#1076). Before it reads an archive the wrapper checks that the largest archive allowed would
  leave more than `PREVIEW_FREE_FLOOR_KB` free on the previews' disk (3 GiB, the floor the production deploy's
  preflight requires), and after measuring it that the archive and what it unpacks to would too. Otherwise it
  refuses with a fixed text, for a new preview and for a redeploy alike. A deploy also refuses, before it asks the
  root step for the content copy, when `PREVIEW_COPY_MAX_BYTES` more would not leave the floor.
- **`list` and `teardown`** (#1076). `list` prints one line per pull request number found anywhere, the folder,
  the Caddy block or the PM2 process (`preview=<n> commit=<sha|none> idle=<seconds> folder=<yes|no>
block=<yes|no> process=<online|stopped|none>`; `idle` is the age of the `current` link, the folder's when
  there is none), so a leftover with no folder is seen. `teardown <number>` succeeds again when there is nothing
  to remove, and also removes a block or a process that has no folder.
- **An upload's unpacked size** is limited, as well as its compressed size: the wrapper adds up the sizes in the
  archive's listing before it unpacks anything and refuses more than `PREVIEW_UNPACK_MAX_BYTES` (3 GiB), a size
  with more digits than the limit (so a huge sparse-file size can't wrap the sum) and an archive whose listing it
  can't measure. A 1 GiB `.tar.gz` could otherwise fill production's disk.
- **Not covered:** a process a preview starts and detaches survives `teardown`, which stops only PM2's
  process; the account's own folder has no disk quota beyond the limits above and `PREVIEW_MAX_COUNT` (a
  running preview can write without limit); and a running preview app, which has the account's user id, can
  swap an archive between the wrapper's measuring and unpacking it (the size is measured from the file, not
  from what is unpacked). Previews write their PM2 logs into their own folder (`PM2_LOG_DIR`), not
  `/var/log/pm2`.
  The workflow that calls the wrapper is #1075.

Undo: revert the pull request, then delete the key line, `/etc/sudoers.d/sprecher-east-preview` and
`/usr/local/lib/sprecher-east-preview`, and `userdel` the account. For the guards: `iptables -D OUTPUT` and
`ip6tables -D OUTPUT` with the rule's arguments (as `-S` lists them), `systemctl disable` and delete the unit,
the account's line in `cron.deny` and `at.deny`, and `chmod` back to the modes the annotation gave.

## Developer site

`https://dev.sprechereast.com` is the developer pages and the Storybook showcase, as static files that the same Caddy
serves: how it is built, published, checked and undone is in [`developer-site.md`](developer-site.md).

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
whole-server backups (hPanel → VPS → Backups & Monitoring) include this folder (same account). A
weekly sealed copy also goes to Google Drive: [`offsite-backup.md`](offsite-backup.md).

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
mkdir -p /root/restore && tar -C /root/restore --no-same-owner --no-same-permissions -xzf /var/backups/sprecher-east/daily/<archive>.tar.gz
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
