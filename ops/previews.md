# Pull request previews: the Caddy base

Each pull request preview gets its own address, `pr-<number>.dev.sprechereast.com` (#1070). This
page covers the part that prepares Caddy (#1072), the server side that follows it, and the workflow
that builds and deploys a preview ([below](#the-workflow-1075)). Back to the [server scripts](README.md).

- **DNS.** One wildcard A record, `*.dev`, in the Porkbun zone for `sprechereast.com`, pointing at
  the production server. It needs no API key. Undo: delete the record. `dev.sprechereast.com`
  itself has its own A record (added 2026-11-24, #1459) and serves the [developer site](developer-site.md),
  not a preview.
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
  certificate storage, so a reopened pull request is not a new order. The developer site's name,
  `dev.sprechereast.com`, is one more name in the same budget (#1459): one order when its block first loads, and
  renewals are exempt. A preview's component showcase orders none ([in `developer-site.md`](developer-site.md#the-component-showcase-in-a-preview-1459)).
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
  reached by a key that can run only the wrapper's six actions, with one sudo rule for the Caddy block
  script. What it is, what it may do and how to check it: [`README.md`](README.md#pull-request-preview-account).
  `environment.sh` holds its names (`PREVIEW_USER`, `PREVIEW_HOME`, `PREVIEW_ACCESS_DIR`), the
  upload limit, the most previews at once (`PREVIEW_MAX_COUNT`, the cap, one for now), the disk floor (`PREVIEW_FREE_FLOOR_KB`), the idle limit (`PREVIEW_IDLE_DAYS`) and the number and commit patterns, so no script writes its own.
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
  could read the environment's key; the server is the boundary. The key can run only the wrapper's six
  actions, and a failed isolation check takes the preview down (above). `.github/scripts/preview-workflow.test.mjs`
  fails when an honest change moves the key next to the build.
- **Setting the key up.** The key pair is done (#1385); repeat this only for a new key, such as when the private half is lost (#1415): the new public half replaces the old line on the next production deploy, and the `preview` environment and its secrets are made again. The public half is committed as `ops/preview-deploy-key.pub` and the private half is the `PREVIEW_SSH_KEY` secret. GitHub's environment and secret calls need a token that can write secrets, which an
  AI agent's cloud session may not have. On a trusted machine: `ssh-keygen -t ed25519 -N '' -C
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
- **The first database and its test accounts** (`e2e/previewSeed.ts`, run by `payload run` from
  `deploy-release.sh` after the migrations and before the switch; #1075, #1393): a new SQLite database built
  from the migrations, with one verified test account per role that signs in with a password: `admin`,
  `editor`, `resident` and `guest` (`preview-<role>@example.com`; `agent` is left out: it has no password
  sign-in and a preview never gets an API key). The first account registered on an empty `users` collection
  becomes an admin (#354), so a preview anyone can open is never reachable with it empty. **The passwords** are
  random, per account and per deploy, made by `ops/preview-accounts.sh` (`main`'s copy, never the pull
  request's) into `<preview folder>/.preview-accounts`, mode 600, outside `data/` and the release; the seed
  reads that file, named by `PREVIEW_ACCOUNTS_FILE`, and refuses one that is not a private file of its own
  user. Nothing puts a password in an environment variable, an argument, a log line or a comment, and the
  deploy log says only that they were made. No email is made. Every deploy gives each existing account its new
  password, role and verified state and unlocks it, which also ends its sessions, so a redeploy signs these four
  accounts out and their old passwords fail; the database is rebuilt on every deploy ([below](#production-content-in-a-preview-1397)), so any other account made while testing is gone with it.
  The seed's own failure prints one fixed line, never its error (`runPreviewSeed`; the deploy log is public);
  Payload's start-up errors (a database it cannot open) still print and hold no password, because passwords reach
  Payload only in the seed. When every account has its password the seed writes `.preview-accounts.applied`,
  the file's SHA-256 (mode 600), which is what lets the passwords be handed out
  ([below](#the-workflow-1075)). The seed refuses to run outside a preview, and the demo seed stays off in production builds
  (`isSeedEnabled`). Production's accounts and settings are never read or copied. The role list is one
  constant, `PREVIEW_ACCOUNT_ROLES` in `src/endpoints/seed/preview-accounts.ts`, and `environment.sh` names the
  same roles for the script, with a test keeping the two equal. How the owner or an AI agent gets the
  passwords is [below](#the-workflow-1075); the content copy that fills the database first is
  [below](#production-content-in-a-preview-1397).
- **Handing out the test sign-in** (#1394). The repository is public, so a password may not appear in a log,
  a comment or an artifact. The owner's decision (2026-11-20, #1077): the AI agent signs in through the browser
  for him, so a password travels only if he asks, and then privately. How it is obtained without a public
  trace: **sealed to the requester.**
  1. The wrapper's sixth action, `credentials <number>`, prints the preview's `.preview-accounts`, and only when
     `.preview-accounts.applied` holds that exact file's SHA-256 (the seed wrote it after giving every account its
     password), the file is private (mode 600, not a link) and has, in order, one `<role>=<secret>` line per role (`is_secret` in `secret-lib.sh`) and a newline at the end. Otherwise
     it refuses with a fixed text (`there is no such preview`, or `the preview has no test sign-in to hand out`):
     after a failed seed, or on a branch whose seed ignores the file, the passwords match no account and are
     never served. A missing preview, a bad number and extra words are refused like any other request.
  2. The workflow `.github/workflows/preview-sign-in.yml` runs on `workflow_dispatch` only (write access
     needed), never on `pull_request`, and is not a required check. It names the `preview` environment, checks
     out the default branch's scripts and runs `.github/scripts/preview-credentials.sh` with the pull request's
     number and the requester's one-time **public** key (RSA, 3072 bits or more, PEM, as one line of base64),
     which the script reads from the dispatch event's inputs and not from a step's `env:` (the runner echoes
     that in the public log, so a private key sent by mistake would show). The script asks `credentials`, masks the plaintext (`::add-mask::`) before anything else, seals it with
     RSA-OAEP and SHA-256 (`openssl pkeyutl`, no new dependency; a 4096-bit key is advised) and prints only the
     ciphertext between `sealed-sign-in-begin` and `sealed-sign-in-end`.
  3. The requester makes a key pair for each request in their own sandbox, dispatches, reads the ciphertext from the
     run's log through the REST API, opens it locally and deletes the key. The plaintext never leaves their
     machine. The steps for agents are in [`docs/process/preview-sign-in.md`](../docs/process/preview-sign-in.md).
  - **Weighed and not chosen:** reading the file over SSH as the owner (the key's private half exists only as the
    environment secret, and a second key would widen the account's reach); a password or one-time link in a
    comment or artifact (public); a fixed or derived password (defeats "random per preview"); `age` or GPG
    instead of `openssl` (a new tool on the runner for no gain).
  - **Honest limit:** a dispatch runs the workflow file of the branch it is given, so someone with write access
    could dispatch a branch that prints the plaintext. They could already change the preview's code, which holds
    the same throwaway accounts on a copy of public content, so this adds no reach; the environment's secrets
    and the restricted account are the boundary.
- **What a result looks like.** The comment says one of: live (with the link), deploy failed (the previous
  release was put back where there was one), **taken down** (the isolation check failed before or after the
  deploy: a failed check before it takes down a preview already running under that number, so the comment
  says so), not started because the cap is reached (the comment names the cap and the pull requests that hold the
  places; when the list can't be read again after a cap race it names only the cap), not started because the server lacks the free disk, **removed** (the pull request closed), not started
  because the build is too big, build failed, or **previews unavailable**. Unavailable means the environment doesn't hold the key yet, or the server
  doesn't take it: the production deploy writes the key's line only when the host guards and the isolation
  check pass, so "no key line" shows from outside as a refused sign-in. It is reported once and **never
  retried**.
- **A pull request opened before this was merged** has an older `e2e/previewSeed.ts`, which ignores the passwords
  file: its deploy still succeeds and leaves one admin nobody can sign in to, and `.preview-accounts` holds four
  passwords that match no account until the branch is rebased on `main`. The hand-out refuses those (no
  `.preview-accounts.applied`, or one that does not match the file). Only a branch with no `e2e/previewSeed.ts` at all stops, with "the preview's
  database could not be prepared". A seed that fails after the script made the file leaves the same mismatch,
  and the hand-out refuses it the same way: the deploy stops and the previous release keeps running, and the
  next deploy makes a matching set (until then no sign-in can be handed out for that preview). The seed also refuses to run without a pull request number, a second check against an honest mistake such
  as running it by hand: it lives in the release's own code, so it is no boundary. Production is kept out by the
  `is_preview` gate in `main`'s `deploy-release.sh` and by the preview account's isolation.
- **Not covered.** A detached process a preview starts survives `teardown`, which stops only PM2's process
  (the account can't schedule jobs: cron and at are denied).

The component showcase in a pull request's preview is described in [`developer-site.md`](developer-site.md#the-component-showcase-in-a-preview-1459).

## Production content in a preview (#1397)

Every preview deploy loads production's published content, so a change is judged on real pages, posts, events and
pictures (part of #1077; what is copied is `src/platform/payload/previewCopy/classification.ts`). The owner decided
the snapshot is deleted right after, media is copied only for copied documents, and the preview account never reads
the snapshot (2026-11-11, recorded on #1077).

- **Rebuilt on every deploy** (decided on #1397). The wrapper's `deploy` removes the preview's database and media, then
  `deploy-release.sh` builds a fresh SQLite file from the pull request's migrations, imports the content
  (`e2e/previewCopyImport.ts`, the pull request's own code, which reads only the export's file), and then
  `previewSeed.ts` makes the test accounts. Changes made while testing a preview, uploads included, are lost on the next
  push. A copy that fails changes nothing: the old database and media are replaced only after the root step succeeded. A
  deploy that fails after that point leaves the preview's running release on its new, rebuilt database (empty or
  half imported), so redeploy it; the isolation check still holds.
- **The root step** (`preview-copy.sh`) is `preview-caddy.sh`'s sibling: one sudo rule per script, a number of 1 to 6
  digits, a fixed PATH, bash's privileged mode, no caller environment, the shared Caddy lock (one at a time with
  production's scripts and every other preview step; the temporary one-preview cap stays). Under the lock it makes a
  snapshot with production's own `ops/backup-db.mjs` (`VACUUM INTO`, a consistent copy while the site runs) into a new
  folder inside `PREVIEW_COPY_TMP` (`/var/lib/sprecher-east-preview-copy`, root-only, mode 700, made by the installer),
  runs the export from **production's current release** (`main`'s code; `payload run e2e/previewCopyExport.ts`, with
  `NODE_ENV=production` and an empty environment but a throwaway secret and an empty `SMTP_HOST`, so nothing could
  be mailed). It runs from a folder of its own under the snapshot folder, because `payload run` loads settings files
  from its working folder and the ones above it: with an absolute script path and the release's TypeScript settings
  (`TSX_TSCONFIG_PATH`), no settings file of production's is read, and a test shows none is found and no production
  secret reaches the export (decided on #1397). The export is bounded: it ends after `PREVIEW_COPY_SECONDS` (240),
  and is killed 10 seconds later if it ignores the stop, so the export cannot hold the shared lock past that (the
  rest of the step is short). The snapshot is deleted as soon as the export ends. A trap deletes
  the folder at the end of every run, success or failure, and a run that was killed leaves a folder the next run
  removes first; so does the installer, with a staging folder a killed run left as root's, which the account can't
  remove (under the lock, so no copy is running; it warns and leaves them when the lock is held). The root step finds
  `node` only in a folder, and as a file, that only root can write (the installer checks the same, so a host that
  would fail it is told at install time); it checks the folder and file, not every ancestor, which are root's on a
  server set up as ours is. The snapshot is never in the preview's reach: the account can't enter its parent, which the
  isolation check proves.
- **The file** is the export's output, printed on the script's standard output; the wrapper writes it as the preview
  account (`<preview folder>/.preview-copy.json`, mode 600), so root never writes a path the account can swap. The import
  deletes it, and the wrapper removes it again after the deploy, success or not.
- **Media** (decided on #1397): only the files the export lists (the original and each size), as **hard links** to
  production's files, made by the root step into an empty staging folder (`.copy-media`) that the wrapper moves to
  `public/media` after a successful copy. A link shares production's inode, owner and mode, so the preview reads the
  file and can't change it in place, and deleting a link removes only the preview's name. Ubuntu's `protected_hardlinks`
  stops an unprivileged account linking a file it doesn't own, so only root can make them. A file is linked only when
  it is a regular file (never a link), root's, readable by all and writable by no one else; anything else, and a file
  on another filesystem, is copied (still root's and not writable), counted against the disk floor, which a copy that
  would cross refuses. A name that is not a plain file name is left out, counted. **Does Payload rewrite a media file in
  place?** Read in Payload 3.91 (`collections/operations/utilities/update.js`, `uploads/`): replacing a file or saving a
  crop first deletes the old files (`unlink`, so only the link goes) and then writes the new ones as new files, so a
  replacement works in a preview and never reaches production's inode. The one write onto an existing name is a draft
  saved over a published document, which skips the delete; that write fails with permission denied on a link, the
  accepted outcome. Deleting a record unlinks its names. The isolation check proves the rest: a picture its folder
  shares with production (link count above one) is neither the account's nor writable by it.
- **The root step opens nothing by a path the account could swap.** The staging folder is opened once; its real path,
  type and owner are read from the open file; it is made root's while it is filled (the account can add nothing), and
  every name is made inside that open folder. A link or a swapped folder is refused, never followed, and the folder goes
  back to the account, its files still root's, when it is done (and, emptied, when it fails).
- **No mail** (decided on #1397): a preview has no `SMTP_HOST` (#1344), the export runs with none, and the import writes
  through the adapter's `create` with no hook, so no email, cache refresh or search entry; a test proves the import and
  the search rebuild send none (`previewCopy/import.test.ts`).
- **No content, name or password in the log.** The root step's standard error holds numbers (media linked, copied, left
  out) and fixed texts; the export's and the backup's own output is dropped except its summary line; the import prints
  numbers or one fixed line. The file and the snapshot are never printed. Tests assert that no secret text reaches
  either stream (`ops/preview-copy.test.mjs`, `ops/preview-wrapper.test.mjs`).
- **Teardown and the sweep remove everything** (#1076): the folder holds the linked media, the test accounts' file and
  any copy file, so `teardown` deletes all of it, and only the preview's links (a test shows production's file and its
  link count unchanged).
- **Before the first run on the server:** the production deploy installs the script, the sudo rule and the folder
  through `install-preview-access.sh`, so merging this is the whole rollout; a preview built before it has no import
  script and fails its deploy until it is rebased on `main`. Rolling back is reverting the pull request: the next
  production deploy puts the rule and scripts back, and previews return to seed-only. The snapshot folder is left,
  empty.

## Removal, the cap and the sweep (#1076)

- **Removal when the pull request closes**, merged or not (`preview.yml`, job `teardown`, in environment
  `preview`; for a merge the run's ref is the base branch and the job still names only `preview`). It is in the
  same concurrency group as that pull request's deploy and never cancels one: a deploy in progress finishes
  first, and a deploy still waiting is replaced by the removal. `.github/scripts/preview-teardown.sh` asks the
  wrapper's `list`, and only when the number is there asks `teardown`, then `list` again to prove it is gone. The
  wrapper stops the PM2 process, deletes the folder (releases, database, media, data and settings file are all
  inside it, with the linked media and the passwords file) and removes the Caddy block, then validates and reloads Caddy; each step succeeds when its item is
  already gone, so a second run succeeds too. The order is the wrapper's (process, folder, block) because
  `preview-caddy.sh` removes a block when the folder is gone. **Caddy's certificate storage is never touched**,
  so a reopened pull request reuses its certificate. A job edits the sticky comment, only when one exists, to
  say the preview was removed. A fork's or Dependabot's pull request never had a preview and is skipped. A
  deploy can still put a closed pull request live again, by two routes: a build that started before the close
  can reach its deploy after the removal ran, and a removal still waiting in the group is cancelled by a deploy
  that enters the group after it (GitHub keeps one waiting job per group). The nightly sweep removes it, because
  its pull request is not open.
- **The cap** is `PREVIEW_MAX_COUNT` in `ops/environment.sh`, defined once. The workflow's check
  (`preview-deploy.sh`), the wrapper (a new folder, under a lock) and the Caddy script (a new block) all read it.
  It replaces the workflow's temporary one-preview limit and has the same value, **one, until it is measured**:
  with production and Umami running, one preview's memory at rest and during a short click-through, free
  memory and swap, and the disk one preview uses (release, database, media), taking #924's figures where they
  exist. The cap is the number that keeps production's memory headroom, the deploy's 3 GiB free-disk floor and
  the backup reserve intact; then it is raised in that one line. Those measurements need the server and are not
  made by this change (recorded on #1076).
- **At the cap: refuse** (decided, #1076). The sticky comment names the cap and the pull requests that hold the
  places, and the preview starts on a later push or re-run once a place is free. Replacing the preview pushed
  least recently was weighed and not chosen: it would take down a preview someone may be reviewing, to give a
  place to a pull request that may have none to review, and with closing and the sweep freeing places on their
  own the refusal is the less surprising of the two. A preview that already holds a place is redeployed even at
  the cap.
- **One gate, one list reader.** The jobs that hold the key (server facts, removal, sweep) set up `ssh vps`
  through `.github/actions/preview-ssh`, which checks all four connection values, the pinned host key included,
  and otherwise does nothing; the runner scripts read the wrapper's `list` only through
  `.github/scripts/preview-list-lib.sh` (the call, the strict line pattern, "does it hold this number"). The
  deploy counts places by folder, as the server's cap does. An older wrapper's `list` (no fields) is refused by
  all three, so nothing is removed or started until the new wrapper is installed.
- **The disk guard** is the wrapper's (README, "Disk floor"): a new preview or a redeploy is refused, with a fixed
  text the workflow turns into the comment "not started", when free disk afterwards would not stay above the
  production deploy's floor. It counts the archive and the release it unpacks to, not what the deploy writes
  afterwards (the database, a media copy); the measurement step records that figure and a margin is added then.
  A content copy has its own checks: before the root step the wrapper refuses when `PREVIEW_COPY_MAX_BYTES` (the
  largest copy file) would not leave the floor, after the archive is unpacked; the root step checks the snapshot
  (twice the database) and each media copy against the floor, re-reading free space each time.
- **The nightly sweep** (`preview-sweep.yml`, 07:17 UTC, and by hand with `workflow_dispatch`, in environment
  `preview`) reads the server's `list` first and the open pull requests after, so a preview created in between is
  never taken for a stray, and removes through `teardown` each preview whose pull request is not open, each
  leftover with no folder (a Caddy block or a PM2 process only), and each preview nobody deployed for
  `PREVIEW_IDLE_DAYS` (7). The next push or a re-run of the deploy brings an idle one back, with its stored
  certificate. If either list fails the sweep removes nothing. The job summary lists what was removed and why.
  The token it has reads pull requests and writes nothing. It is not serialized with a deploy of the same
  number, so it reads that number's line again just before each removal and applies its rule afresh: a preview
  deployed meanwhile is left alone (the window that remains is a whole upload and deploy of a preview whose `current` link is still the old one, which can still be torn down in the middle; a later change could make `teardown` take the upload's lock, see #1405). Every
  line of the list is checked before the first removal, and the summary is written even when the sweep stops.
- **After a reboot** (decided, #1076; carried from #1345): previews are **not** started again, so production starts
  alone on a small machine. PM2's startup and resurrect would bring every preview back at once and, with Caddy's
  blocks still in place, spend the memory the cap is meant to protect right when production is starting. The
  sweep's summary lists a preview whose process is stopped and leaves it (an idle one is removed by the rules
  above); the next push or a re-run of its deploy starts it. To be checked once on the server after the cap is
  measured: reboot, see production answer and the previews stopped, see that the first `list` (a closed pull
  request's removal, or the sweep) starts the preview account's PM2 daemon and brings no preview back, push to
  one and see it come back.

- **Undo.** Delete or disable `preview.yml` and `preview-sweep.yml`; production is untouched. Remove a running preview with the wrapper's
  `teardown`; reverting the removal and sweep leaves previews until `teardown` is run by hand.
