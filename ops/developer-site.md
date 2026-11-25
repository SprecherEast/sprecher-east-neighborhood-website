# Developer site (#1459)

Back to the [server scripts](README.md).

`https://dev.sprechereast.com` opens an index page for the people building the site, which links to the
component showcase (Storybook, #1424) and has a marked place for the system map (#1446). It is static files
served by the same Caddy as the live site: no second app, no host check in the app, no sign-in (the
repository is public, so the page shows nothing that is not), and kept out of search engines. The owner decided
this on 2026-11-24 (recorded on #1424, #1446 and #1459); the findings and the options weighed are on #1459.

```text
/var/www/sprecher-east-developer/       root-owned, a sibling of production's and the previews' folders
  releases/<release>/                   index.html, 404.html, style.css, showcase/ (nothing else), one per publish
  current -> releases/<release>         what Caddy serves
/etc/caddy/previews/developer.caddy     the site block (ops/caddy/developer-site.caddy), imported by the
                                        previews' import line; not `pr-*.caddy`, so the preview scripts never see it
```

**What the production deploy does, in order** (`developer-site.sh`, from the release's own `ops/`, after the
release is live and `caddy-previews.sh` has run). A step that fails stops the next ones and leaves the previous
developer site, files and block, as it was:

1. **In the build job** (no secret): `build-showcase.sh` runs `npm run storybook:build` into the release's
   `developer-site/showcase` (about 40 s, 9 MB more upload, 15 MB more per kept release on the server). If it
   fails or takes over 10 minutes, the release is built without a showcase, with a warning; the build never fails
   for it. The font comes from the `@fontsource/poppins` package, bundled into the build (`.storybook/fonts.css`).
2. **Preconditions**, each a warning and no change: Caddy and its Caddyfile are there, the developer folder is
   neither inside nor above production's, a preview's or Caddy's (its config folder and its storage folder, with the certificate keys; compared after `realpath -m`; the block file is
   always `developer.caddy` in the previews' folder, never taken from the environment), the Caddyfile imports the
   previews' folder, the headers file is this release's copy, this release is still the live one, the release has
   a showcase that really is inside its folder (not a link out of it), nothing else is changing Caddy (the shared lock, waited for at most `DEVELOPER_LOCK_WAIT`, 30 s: a
   skip costs nothing, and the script must not hold up the deploy), the current Caddyfile validates, and production's
   home page answers through Caddy.
3. **Assemble and check.** The release's showcase is judged first, as it is (`developer-site-check.sh --source`:
   no link, no file with another name elsewhere, no pipe), because a copy turns a link into the file it points to.
   Then it and the pages are copied into a staging folder, which `developer-site-check.sh` judges again: only
   `index.html`, `404.html`, `style.css` and `showcase/`; no link, no file with another name elsewhere, no hidden
   name, no file named like a database (with its `-wal` and `-shm`), key, dump, archive, backup, log or environment
   file, in any letter case, nothing writable by anyone, at most `DEVELOPER_MAX_BYTES` (100 MiB), no mention of Google's font hosts in any file, in any letter case. Then it is renamed into
   `releases/<release>`.
4. **The block.** Made from the template, checked by Caddy alone, then `caddy_place_block` (`caddy-block-lib.sh`,
   the function `preview-caddy.sh` uses too) makes a whole, compared copy of the previous block, moves the new
   one in with one rename, has Caddy check the whole config, reloads, and waits for production's home page. It runs
   inside an `if`, where `set -e` is off, so each step is checked by hand: a copy that did not finish or a rename
   that failed changes nothing and is never "restored"; a rejected config, a reload that fails or a site that
   stops answering puts the previous block back and reloads again. A copy that cannot be put back stays in the
   folder under a name the import does not match, and the warning names it.
5. **Switch.** `current` is pointed at the new release with one atomic rename.
6. **Live check**, through Caddy on the server: `/` and `/showcase/index.html` answer 200; the page sends
   `X-Robots-Tag: noindex` and no `Strict-Transport-Security`; `/robots.txt` says `Disallow: /`; `/api/version`,
   `/admin` and `/.env.local` answer 404 (the app is not behind this name). It waits up to 120 s the first time
   (Caddy orders the certificate when the block first loads) and 20 s after. If it fails and there was an earlier
   developer site, `current` goes back to it, and the block this release replaced with it; with none to go back to, the new files stay and the warning says
   the certificate may still be on its way.
7. The newest 2 releases are kept (`prune_releases`, `releases-lib.sh`, which the production deploy uses too).

Whatever happens in these steps, `deploy-release.sh` ignores the script's exit status and prints a warning, so the
production deploy stays green, and the script runs after production's switch and health check, so it cannot roll
production back. Run it by hand on a release that is live: `bash releases/<release>/ops/developer-site.sh`.

**What it can't reach.** Caddy serves one folder of static files with `file_server` and no proxy, so there is no
app behind the name. The folder is judged by what is in it, never by how it was made; links are refused because
Caddy's user can read what the web server's user can (certificate keys among it), so one planted link would
publish it. The block never imports the HSTS file or the form limits (a test fails if it does) and the template has
one root, the developer folder. No secret is added anywhere.

**Headers.** The block imports `/etc/caddy/sprecher-east-preview-headers.caddy`, the pull request previews' own
snippet, so there is one copy: `X-Robots-Tag: noindex, nofollow` on every answer, including the 404 page, and a
`/robots.txt` that disallows everything. No HSTS: production's rule has no `includeSubDomains`, so it does not
bind this name, and a test fails if that changes ([`previews.md`](previews.md)). The 404 page is a `rewrite * /404.html`
inside `handle_errors`, which every Caddy version reads the same (a single argument needs 2.8 or later).

**The site's CSS.** The built showcase sits in the release (`developer-site/`, or `public/showcase/` in a preview),
and Tailwind scans every file under the project that git does not ignore: both folders are in `.gitignore`, so the
showcase's classes never reach the site's CSS (a test scans a tree with the repository's `.gitignore` and fails
if either folder is read). ESLint ignores them too; the other tools read `src`, `ops`, `scripts` or git's file list.

**Certificate.** One new name, `dev.sprechereast.com`, one order when the block first loads; renewals don't count
against the weekly limit ([`previews.md`](previews.md), the certificate budget bullet). The DNS record is
an A record `dev`, added on 2026-11-24 (#1459).

**Undo.** Remove the block, then the folder: `rm /etc/caddy/previews/developer.caddy && caddy validate --config
/etc/caddy/Caddyfile && systemctl reload caddy`, then `rm -rf /var/www/sprecher-east-developer`. Reverting the pull
request stops the updates but leaves both. Deleting the `dev` A record ends the name; nothing else depends on it.

**Check on the server after the first deploy** (not provable before: the tests use stand-ins for Caddy): the
deploy's `Server` annotations say `Developer site published`; `curl -sI https://dev.sprechereast.com/` shows 200,
the noindex header and no HSTS from outside; `/robots.txt`; a wrong path answers 404 with the 404 page and the
noindex header; `/showcase/index.html` works on a phone and a desktop (stories load, theme, mode and width
switches), and the browser's network tab shows no request to a font host outside the site. The site's own CSS file
(`/_next/static/chunks/*.css`) is the size it was before this deploy, within a few bytes (the showcase must not
have grown it; it was about 147 KB). Plain HTTP to `http://dev.sprechereast.com/` goes to the same name over HTTPS,
not to `sprechereast.com` (production's `:80` block catches other names). Record the results on #1459.

## The component showcase in a preview (#1459)

A pull request that changes a story, a shared component or what it imports (`src/platform/ui/`, `src/platform/richtext/`, `src/platform/lib/`), the theme
(`src/platform/theme/`, `src/themes/`, `globals.css`) or the showcase's settings, build script or packages
(`.storybook/`, `ops/build-showcase.sh`, `postcss.config.*`, `package.json`, `package-lock.json`; the one list is
`.github/scripts/showcase-paths.sh`, notes and tests excluded) gets the component showcase built into its preview:
`plan-preview.sh` writes `showcase=true` for it, and the build job gives `ops/build-release.sh` the folder
`public/showcase`, so `ops/build-showcase.sh` builds it into the release before the site's build (only what is in
`public/` at build time is served). The comment then adds `<preview address>/showcase/index.html`.

- **Served by the preview's own app**, not by Caddy: the preview's Caddy block only proxies to the app, on purpose.
  Caddy runs as a user that can read what the preview account cannot (its certificate keys), and a pull request's
  code could plant a link to one in a folder Caddy serves. A static file the app serves is no more than the pull
  request's code can already do. So no Caddy block, wrapper, sudo rule or server script changes, and no new
  certificate name: the showcase is a path under the preview's own address.
- **Out of the site's CSS:** `public/showcase/` is in `.gitignore`, which Tailwind's source detection follows, so
  the preview's CSS does not carry the showcase's classes (see above).
- **Same headers** as every answer of the preview (noindex, no HSTS), and **removed with it**: the files are in the
  release folder, which teardown deletes.
- **Required for a preview that asks for it:** a showcase that does not build fails the preview's build, and the
  comment says the build failed. (The production deploy's build treats it as optional.)
- **What it adds** to such a preview: about 40 s of build time, 9 MB more upload, and 15 MB of disk in each of its
  two kept releases. A preview without those changes builds exactly as before.
