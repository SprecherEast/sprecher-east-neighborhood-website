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
caddy`. The folder and headers file paths are defined once, in `lib.sh`.
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
