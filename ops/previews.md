# Pull request previews: the Caddy base

Each pull request preview gets its own address, `pr-<number>.dev.sprechereast.com` (#1070). This
page covers the part that prepares Caddy (#1072), the server side that follows it, and the workflow
that builds and deploys a preview ([below](#the-workflow-1075)). Back to the [server scripts](README.md).

- **DNS.** One wildcard A record, `*.dev`, in the Porkbun zone for `sprechereast.com`, pointing at
  the production server. It needs no API key. Undo: delete the record. `dev.sprechereast.com`
  itself doesn't resolve.
- **The import line.** `caddy-previews.sh` adds `import /etc/caddy/previews/*.caddy` (and a comment
  line above it) to the Caddyfile. Before anything reloads, Caddy must accept the new Caddyfile
  together with a sample preview block made from the template, so a broken snippet fails the deploy
  here, not at the first preview. The Caddyfile is backed up first, and everything is put back if
  Caddy won't reload or the site stops answering. The folder is empty until a preview exists, which
  Caddy accepts. Every production deploy runs it, and it adds the line once. Undo: revert the pull
  request, delete the line, then `caddy validate --config /etc/caddy/Caddyfile && systemctl reload
caddy`. The folder path is defined once, in `environment.sh`; the headers file path, in `lib.sh`.
- **Every file in the folder is production's config.** Caddy loads each `*.caddy` file there with
  the rest of the Caddyfile, so one invalid file makes every later reload fail, and stops Caddy from
  starting after a restart. The preview deploy (#1075) must validate a block, with the headers and
  limits it imports, before it moves it into the folder, and must move it in atomically.
- **Headers.** `caddy/preview-headers.caddy` sends `X-Robots-Tag: noindex, nofollow` and answers
  `/robots.txt` with `Disallow: /` from Caddy itself. `caddy/preview-site.caddy` is the template for
  one preview's block: the headers, the form limits, and the app on a loopback port. Neither sends
  HSTS: production's rule has no `includeSubDomains`, and a test fails if that changes or a
  preview block imports the HSTS file.
- **Unknown names.** No on-demand TLS and no wildcard certificate, so HTTPS to a `*.dev` name with
  no block gets no certificate and no page; plain HTTP falls to the `:80` catch-all.
- **Certificate budget.** Caddy orders one certificate per preview name when its block loads
  (Let's Encrypt, then ZeroSSL). Let's Encrypt allows 50 new certificates per registered domain
  per 7 days, shared with production's own names, and 5 per identical set of names
  ([limits](https://letsencrypt.org/docs/rate-limits/)); renewals don't count. The repository
  opens far more than 50 pull requests a week, so only a pull request that changes how pages look,
  or that carries the label asking for a preview, gets one (owner's decision, 2026-11-19, #1072).
  A redeploy of the same pull request reuses its certificate, and teardown never deletes Caddy's
  certificate storage, so a reopened pull request is not a new order.
- **Check on the server** (once, after the first deploy with this script; carried to #1075): load
  one sample block by hand, confirm its responses carry `X-Robots-Tag` and no
  `Strict-Transport-Security` and that `/robots.txt` disallows everything, remove it, and confirm
  HTTPS to an unknown `*.dev` name serves nothing and plain HTTP redirects to the production domain.
  Record the results on #1072.
- **Blocks come from `main`.** The preview deploy builds every block from `main`'s copy of
  `caddy/preview-site.caddy` and `caddy/preview-headers.caddy`, never from the pull request's own
  files: a pull request could otherwise drop the noindex header or add any directive to production's
  Caddy.
- **Caddy version.** The deferred header (`header >X-Robots-Tag`) needs Caddy 2.7 or later. On an
  older server the sample check rejects it and the deploy fails with nothing changed.
- **Environments** (#1073). Every script acts on production unless `PREVIEW_NUMBER` names a pull
  request, and `environment.sh` is the one place that says what differs: a preview has its own
  folder under `/var/www/sprecher-east-previews/pr-<number>` (settings, data, media and releases,
  never inside production's folder), PM2 process `sprecher-east-pr-<number>`, a loopback port,
  Caddy block `pr-<number>.caddy` in the previews folder, and the address the health check asks
  for. The deploy workflow sends `environment.sh` ahead of `lib.sh` wherever it sends `lib.sh`
  over SSH, and `ecosystem.config.cjs` reads the same values (production's when none is set).
  A preview's folder, process, port, address and Caddy block come only from its number, never from
  a caller's `APP_DIR`, `APP_NAME`, `APP_PORT`, `SITE_URL` or `CADDY_SITE_FILE`; the root, domain,
  port range and number of releases kept can be set. A number that isn't a pull request number, a
  root that resolves (symlinks and `..` included) into production's folder, or a port range that
  holds production's or Umami's port stops the script.
- **Preview ports.** One range, 3200 to 3999 (`PREVIEW_PORT_MIN` and `PREVIEW_PORT_MAX`), outside
  production's 3000 and Umami's 3100; a preview's port is 3200 plus its number modulo 800, so a
  preview keeps its port on every redeploy. A new preview stops when its port is in use, which can
  only happen between two open pull requests 800 numbers apart. A preview PM2 still lists
  (stopped, say) skips that check, so it keeps its port. The deploy workflow's port check
  reads the range from the same file.
- **What a preview deploy skips.** The pre-deploy backup, the backup job, the production Caddy
  scripts and the Umami install; it keeps the settings checks, the migrations and the health
  check, and the newest 2 releases (production keeps 3). It stops before changing anything when
  its Caddy block isn't in place, and takes a first deploy that never answered down again.
  Undo: revert the pull request; with no environment named, nothing on the server changes.
- **A preview's settings** (#1344). `preview-settings.sh` writes `<preview folder>/.env.local` at the
  first deploy, from the number alone: its own address, `PAYLOAD_SECRET` and `PREVIEW_SECRET` made
  at random on the server (so a production sign-in token is worth nothing on a preview), Cloudflare's
  published always-pass Turnstile test keys (`environment.sh`), a placeholder `CONTACT_NOTIFY_EMAIL`,
  and no `SMTP_HOST` (email is logged, never sent), analytics ID, GitHub token or outside sign-in
  key. The file is mode 600, never copied from production, and kept on every later deploy so a
  redeploy doesn't sign anyone out. A kept file must match exactly what the script writes (each
  secret on one line and generated, nothing added or changed); anything else stops the deploy,
  naming the problem and never a value. A link at the preview's folder or file is refused before
  anything is read or changed. The build for a preview must
  use the same Turnstile site key, or the deploy's settings gate refuses it. The restricted preview
  account's deploy runs this script from main's root-owned copy, never from the release (#1345).
- **The restricted account** (#1345). Previews deploy and run as one account whose home is root-owned,
  reached by a key that can run only the wrapper's five actions, with one sudo rule for the Caddy block
  script. What it is, what it may do and how to check it: [`README.md`](README.md#pull-request-preview-account).
  `environment.sh` holds its names (`PREVIEW_USER`, `PREVIEW_HOME`, `PREVIEW_ACCESS_DIR`), the
  upload limit, the most previews at once (`PREVIEW_MAX_COUNT`, 10) and the number and commit patterns, so no script writes its own.
- **The key is in place** (#1385). The public half is committed as `ops/preview-deploy-key.pub`; the private half is the
  `PREVIEW_SSH_KEY` secret of the GitHub environment `preview`, and nowhere else. The production deploy writes the key's
  line only when the host guards and the isolation check pass; its log says which.
- **What the account can't reach** (#1346). `preview-isolation-check.sh` runs as the account before and after every
  preview deploy and fails the deploy (before: nothing starts, and a preview already running under that number is taken down; after: the preview is taken down) when the account can open production's
  settings, database, media, backups, Umami files, PM2 logs or Caddy's storage, or connect to Caddy's admin
  endpoint on localhost. `preview-host-guards.sh` makes that so: production's folders closed to "others",
  the account in `cron.deny` and `at.deny`, and an owner-match firewall rule on the admin port. An upload
  is also limited by what it unpacks to (`PREVIEW_UNPACK_MAX_BYTES`, 3 GiB). Details, the unix socket
  alternative and why it wasn't chosen, and the check to run on the server:
  [`README.md`](README.md#pull-request-preview-account).
- **No basic auth.** A preview holds only public code and published content, a password would block opening
  the link on a phone and AI agents taking screenshots, and the noindex headers above stay required.

## The workflow (#1075)

`.github/workflows/preview.yml` builds a pull request and puts it live at its address, then keeps **one
comment** on the pull request up to date with the link, the short commit, the time and whether the deploy
worked (found by a hidden marker and edited in place, so a new push never adds a second one). It is not a
required check: a failed preview never blocks a merge or the production deploy.

- **When.** On a push to a pull request (opened, synchronized, reopened) or when the `preview` label is
  added, and only when all of this holds (`.github/scripts/plan-preview.sh`; a "no" ends green with a job
  summary saying why, and posts no comment):
  1. the head is a branch of this repository, because a fork's run gets no secrets and a read-only token;
  2. the author is not Dependabot, for the same reason;
  3. the change reaches the server: one file outside docs and repository tooling, the list the production
     deploy uses (`.github/scripts/deploy-paths.sh`), compared against the pull request's own base;
  4. the pull request carries the `preview` label. Only the label starts a preview: when an AI agent made a
     visual change it asks the owner, and adds the label once he says yes (the owner's decision of
     2026-11-20, recorded on #1070 and #1075). Each preview orders a certificate from the weekly budget
     production shares (above).
- **Jobs.** `gate` (no secrets) → `facts` (reads the server's Node version as the preview account) →
  `build` (no environment, no secret; the same `ops/build-release.sh` as production, with the preview's
  address as the public site address and the Turnstile test site key, from `environment.sh`) → `deploy` →
  `report` (the comment; a write token for the pull request and nothing else). A push cancels an older
  run's gate and build, but **never a deploy in progress**: cancelling in the middle of the deploy over ssh could
  leave the wrapper's checks unrun, and the deploy script has no lock, so two deploys of one preview could
  overlap. A newer deploy waits its turn (`preview.yml`'s job-level group per pull request) and replaces only a
  deploy still waiting. The wrapper itself does not ignore a dropped connection; a dropped runner can still
  leave a deploy half-run (deploy-release.sh ignores hangups, a broken pipe is not covered), which only a deploy of
  a new commit or `teardown` of that number repairs (a re-run at the same commit finds it already live and checks
  nothing). A label other than `preview` never cancels anything. Re-running
  a run, reopening, or re-adding the label at a commit that is already live reports it live without uploading.
- **What is built.** The pull request's head commit, not its merge with `main`.
- **The key.** The `preview` GitHub environment holds only the restricted account's connection values and
  its private key: `PREVIEW_SSH_HOST`, `PREVIEW_SSH_USER`, `PREVIEW_SSH_PORT` (optional, default 22),
  `PREVIEW_SSH_KEY` and `PREVIEW_SSH_KNOWN_HOSTS` (the host key line, so the server is never trusted on first
  sight). The key pair is made once, by the owner or an AI agent with the access to do it: the public half
  is committed as `ops/preview-deploy-key.pub`, the private half is the `PREVIEW_SSH_KEY` secret, and it is
  never printed or committed. Only `facts` and `deploy` name the environment. No job names `production`,
  and none calls a privileged workflow: the deploy prints release values into this public log.
- **Where the key never meets unreviewed code.** `build` runs the pull request's install scripts with no
  key. `facts`, `deploy` and `report` check out the repository's default branch, never the pull request's
  or its base (a stacked pull request's base is another unreviewed branch), and only list the build's archive and
  send it to the server on stdin: nothing on the runner unpacks or runs it. On a
  same-repository pull request this workflow file is the pull request's own copy, so a dishonest change
  could read the environment's key; the server is the boundary. The key can run only the wrapper's five
  actions, and a failed isolation check takes the preview down (above). `.github/scripts/preview-workflow.test.mjs`
  fails when an honest change moves the key next to the build.
- **Setting the key up** (once; done for the key pair: the public half is committed as `ops/preview-deploy-key.pub` (#1385) and the private half is the `PREVIEW_SSH_KEY` secret, so what follows is the recipe to repeat it, for a new key; GitHub's environment and secret calls need a token that can write secrets, which an
  AI agent's cloud session may not have). On a trusted machine: `ssh-keygen -t ed25519 -N '' -C
sprecher-east-preview-deploy -f preview_key`; commit `preview_key.pub` as `ops/preview-deploy-key.pub` through a
  pull request (the production deploy then writes the key's line, but only when the host guards and the isolation
  check pass); in the repository's Settings → Environments, create `preview` (with no deployment-branch restriction to `main`: a run on a pull request's ref would be rejected and fail instead of reporting "unavailable") and add the five secrets above
  (`PREVIEW_SSH_KEY` is the whole private file; `PREVIEW_SSH_KNOWN_HOSTS` is `ssh-keyscan -t ed25519 <host>`'s
  line; `PREVIEW_SSH_USER` is `sprecher-preview`); delete the private file. Or through the API: `PUT
/repos/{owner}/{repo}/environments/preview`, then `gh secret set <NAME> --env preview`. Until all is in place the
  comment says previews are unavailable.
- **Through the wrapper only.** `.github/scripts/preview-deploy.sh` never calls `deploy-release.sh`: it asks the
  wrapper to `list`, `upload` and `deploy`, which runs `main`'s root-owned copy of the deploy scripts
  (the settings gate, the migrations, the health check of the home page and `/api/version` through Caddy, which
  waits up to `PREVIEW_UP_SECONDS` (180) so the first certificate has time to be ordered, and a switch back to the
  previous release when it fails). Before sending anything it checks the archive's size
  against the upload limit and what it unpacks to against `PREVIEW_UNPACK_MAX_BYTES` (3 GiB); the wrapper
  checks both again.
- **The first database** (`e2e/previewSeed.ts`, run by `payload run` from `deploy-release.sh` after the
  migrations and before the switch): a new SQLite database built from the migrations, with one admin account
  whose password is random and is never stored, logged or shown, because the first account registered on an
  empty `users` collection becomes an admin (#354) and a preview anyone can open must never have it empty. So
  `/admin` shows a sign-in form, nobody can sign in, and no email is made. It does nothing when an account
  exists, so a redeploy changes nothing. The demo seed stays off in production builds (`isSeedEnabled`). The
  copy of published content, and how anyone signs in, are #1077.
- **What a result looks like.** The comment says one of: live (with the link), deploy failed (the previous
  release was put back where there was one), **taken down** (the isolation check failed before or after the
  deploy: a failed check before it takes down a preview already running under that number, so the comment
  says so), not started because another preview is up (the temporary limit of one at a time, until the cap work
  on #1070 lands: `PREVIEWS_AT_ONCE` in the workflow), not started because the build is too big, build failed,
  or **previews unavailable**. Unavailable means the environment doesn't hold the key yet, or the server
  doesn't take it: the production deploy writes the key's line only when the host guards and the isolation
  check pass, so "no key line" shows from outside as a refused sign-in. It is reported once and **never
  retried**.
- **A pull request opened before this was merged** has no `e2e/previewSeed.ts`, so its preview deploy stops with
  "the preview's database could not be prepared" until it is rebased on `main`. The seed also refuses to run without a pull request number, a second check against an honest mistake such
  as running it by hand: it lives in the release's own code, so it is no boundary. Production is kept out by the
  `is_preview` gate in `main`'s `deploy-release.sh` and by the preview account's isolation.
- **Not covered.** A detached process a preview starts survives `teardown`, which stops only PM2's process
  (the account can't schedule jobs: cron and at are denied). Removal when the pull request closes, the nightly
  sweep and the real cap are later issues on #1070.
- **Undo.** Delete or disable `preview.yml`; production is untouched. Remove a running preview with the wrapper's
  `teardown`.
