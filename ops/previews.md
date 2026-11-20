# Pull request previews: the Caddy base

Each pull request preview gets its own address, `pr-<number>.dev.sprechereast.com` (#1070). This
page covers the part that prepares Caddy (#1072); the deploy that writes one block per preview comes
later (#1075). Back to the [server scripts](README.md).

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
