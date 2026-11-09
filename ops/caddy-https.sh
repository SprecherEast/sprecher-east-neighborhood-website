#!/usr/bin/env bash
# HTTPS at Caddy (#235): the domain's HTTPS block sends HSTS, and plain HTTP to the server's IP
# (or to the domain, if a block serves it) redirects to the canonical HTTPS address instead of
# reaching the app.
#
# It only adds lines to /etc/caddy/Caddyfile, and refuses any other change:
#   - the HTTPS site block for the domain gets `import /etc/caddy/sprecher-east-hsts.caddy` (a copy
#     of ops/caddy/hsts.caddy, where max-age is set); www only redirects, so it needs none
#   - each site block that serves plain HTTP (`:80`, `http://<IP>`, `[::]:80`, `http://<domain>`)
#     gets `redir https://<domain>{uri} 308` as its first line. Caddy runs `redir` before
#     `reverse_proxy` in its default directive order, so the request never reaches the app. A
#     global `order` option could change that, so a Caddyfile with one is left alone.
# The canonical address is NEXT_PUBLIC_SERVER_URL. The new Caddyfile is validated, the old one
# backed up (written under a temporary name, compared, then renamed), and then replaced in one
# rename. Success means the domain sends the header and plain HTTP to the domain and the IP
# redirects permanently to https. Otherwise, or on any unexpected failure while changing, what
# was replaced comes back and the script fails. The check also runs when nothing needed changing,
# and when the layout wasn't recognised: then the IP still reaching the app fails the deploy.
# Results, like `curl -I`, are printed as annotations on the deploy run.
set -Eeuo pipefail
umask 077
trap '' HUP # a dropped SSH session must not stop the script between a change and its rollback

. "$(dirname "$0")/lib.sh"

on_unexpected_error() {
  [ "$BASH_SUBSHELL" -eq 0 ] || return 0
  trap - ERR
  report "ERROR: caddy-https.sh failed unexpectedly at line $1; nothing was changed"
  exit 1
}
trap 'on_unexpected_error $LINENO' ERR

APP_PORT="${APP_PORT:-3000}" # the app's port behind Caddy (ecosystem.config.cjs)
SOURCE="$CODE_DIR/ops/caddy/hsts.caddy"
IMPORT_LINE="import $HSTS_FILE"
LIMITS_IMPORT_LINE="import ${LIMITS_FILE:-/etc/caddy/sprecher-east-form-limits.caddy}" # caddy-limits.sh's own line

url=$(site_url)
host="${url#https://}"
if [ "$url" = "$host" ] || ! [[ "$host" =~ ^[A-Za-z0-9.-]+$ ]]; then
  report "WARNING: NEXT_PUBLIC_SERVER_URL is not a plain https:// address, so HSTS and the IP redirect were not touched"
  exit 0
fi
REDIR_LINE="redir https://$host{uri} 308"
hsts_value=$(sed -n 's/^[[:space:]]*header[[:space:]]\{1,\}Strict-Transport-Security[[:space:]]\{1,\}"\(.*\)"[[:space:]]*$/\1/p' "$SOURCE")
if [ -z "$hsts_value" ]; then
  report "ERROR: ops/caddy/hsts.caddy has no Strict-Transport-Security line; nothing was changed"
  exit 1
fi

if ! command -v caddy >/dev/null || [ ! -f "$CADDYFILE" ]; then
  report "WARNING: Caddy or $CADDYFILE not found, so HSTS and the IP redirect were not added"
  exit 0
fi
if ! caddy_accepts "$CADDYFILE"; then
  report "WARNING: the current Caddyfile does not validate in the deploy shell, so it was left alone"
  exit 0
fi
if ! wait_until_up 90; then
  report "WARNING: the home page did not answer 200 through Caddy ($url, got $(site_status /)), so HSTS and the IP redirect were not touched"
  exit 0
fi


stamp=$(date -u +%Y%m%dT%H%M%SZ)
candidate="$CADDYFILE.sprecher-east-https-new"
original="$CADDYFILE.sprecher-east-https-orig"
ip_address_file="$CADDYFILE.sprecher-east-https-ip"
layout_file="$CADDYFILE.sprecher-east-https-layout"
trap 'rm -f "$candidate" "$original" "$ip_address_file" "$layout_file"' EXIT

# Prints the Caddyfile with the lines added. Writes the address of a plain-HTTP block that
# serves the IP (or any host) to $ip_address_file, and one line per site block (its addresses,
# what the script took it for, whether it proxies to the app, what it adds) to $layout_file.
# Exits 3 if the layout can't be read safely (heredocs, a site block on one line, unbalanced
# braces), 4 if no block serves the domain over HTTPS, 7 if a block mixes the HTTPS domain with
# other addresses, 8 if the global options set `order`, 9 if a block that proxies to the app
# serves plain HTTP and HTTPS together. A site's address list may span lines (each but the last
# ending in a comma); it is classified as a whole.
#
# Which blocks get the redirect: every block whose addresses are all plain HTTP (`:80`, `http://`,
# an IP, the domain over http) and, among plain-HTTP blocks for other hosts (such as the server's
# own hostname), those that proxy to the app. A plain-HTTP block for another host that doesn't
# serve the app is left alone.
rewrite() {
  awk -v host="$host" -v imp="$IMPORT_LINE" -v redir="$REDIR_LINE" -v port="$APP_PORT" \
    -v side="$ip_address_file" -v layout="$layout_file" -v limits="$LIMITS_IMPORT_LINE" \
    -v app_addr="(^|[[:space:]])(http://)?(localhost|127[.]0[.]0[.]1)?:$APP_PORT([[:space:]{]|\$)" '
    function clean(s) { sub(/(^|[[:space:]])#.*$/, "", s); gsub(/^[[:space:]]+|[[:space:]]+$/, "", s); return s }
    function ours(t) { return t == host || t == "www." host }
    # Counts the block'"'"'s addresses by kind into the g_* globals, and collects the plain-HTTP
    # IP or catch-all addresses into `caught`.
    function classify(addr,   n, i, t, a) {
      g_apex = g_www = g_plain = g_plain_other = g_https_other = 0; caught = ""; addrs = ""
      n = split(addr, a, /[ ,\t]+/)
      for (i = 1; i <= n; i++) {
        t = a[i]
        if (t == "") continue
        addrs = addrs (addrs == "" ? "" : ", ") t
        if ((t ~ /^(http:\/\/)?([0-9]+\.[0-9]+\.[0-9]+\.[0-9]+|\[[0-9A-Fa-f:]*\])?(:80)?$/) && (t ~ /^http:\/\// || t ~ /:80$/)) {
          g_plain++; caught = caught " " t
          continue
        }
        if (t ~ /^http:\/\// || t ~ /:80$/) {
          sub(/^http:\/\//, "", t); sub(/:80$/, "", t)
          if (ours(t)) g_plain++; else g_plain_other++
          continue
        }
        sub(/^https:\/\//, "", t); sub(/:443$/, "", t)
        if (t == host) g_apex++; else if (t == "www." host) g_www++; else g_https_other++
      }
    }
    # Decides a block once it has been read. Sets `label` and `action` (import, redir or none).
    function decide() {
      https_ours = b_apex + b_www
      plain_all = b_plain + b_plain_other
      action = "none"
      if (b_apex && !plain_all && !b_https_other) { label = "https domain"; domains++; if (!has_imp) action = "import" }
      else if (b_www && !plain_all && !b_https_other) label = "https www (redirect only)"
      else if (https_ours) { label = "MIXED: the domain with other addresses"; mixed = 1 }
      else if (plain_all && !b_https_other && (!b_plain_other || proxies)) {
        label = "plain http"; if (!has_redir) action = "redir"
        if (b_caught != "" && ipaddr == "") ipaddr = b_caught
      }
      else if (plain_all && !proxies && (rp || unknown_import)) {
        label = "UNCLEAR: plain http for another host, may serve the app (" (rp ? "a reverse_proxy to another address" : "an import this script cannot read") ")"
        unclear = 1
      }
      else if (plain_all && !b_https_other) label = "plain http, another host, not the app"
      else if (plain_all && proxies) { label = "MIXED: plain http and https, serves the app"; mixed_plain = 1 }
      else label = "another site"
      if (action == "none" && (has_imp || has_redir)) action = "none (already has its line)"
    }
    {
      text[NR] = $0
      s = clean($0)
      if ($0 ~ /<</) bad = 3
      if (s ~ /^order([[:space:]]|$)/) order = 1
      # An address line ending in a comma continues on the next line.
      if (depth == 0 && s ~ /,$/ && s !~ /[{}]/) { pending = pending " " s; next }
      if (depth == 0 && pending != "" && s !~ /\{$/) bad = 3
      # A site block opened and closed on one line is not read: refuse rather than guess.
      if (depth == 0 && s ~ /\{.*\}/ && s !~ /^&?\(/) { bad = 3; t = s; sub(/[[:space:]]*\{.*$/, "", t); print t " | a site block on one line, not read | ? | adds: none" > layout }
      if (depth == 0 && s ~ /\{$/ && s !~ /^\{/ && s !~ /^&?\(/) {
        classify(pending " " substr(s, 1, length(s) - 1)); pending = ""
        start = NR; has_imp = has_redir = proxies = rp = unknown_import = 0
        b_apex = g_apex; b_www = g_www; b_plain = g_plain; b_plain_other = g_plain_other
        b_https_other = g_https_other; b_caught = caught; b_addrs = addrs
      }
      if (start && depth == 1 && s == imp) has_imp = 1
      if (start && depth == 1 && s == redir) has_redir = 1
      # Proxies to the app: `reverse_proxy <loopback>:<port>`, or in block form a `to` line naming
      # it. Unsure: a reverse_proxy to anything else (a placeholder, another upstream), or an
      # import this script cannot see into (its own two snippets aside).
      if (start && depth >= 1) {
        if (s ~ /^reverse_proxy([[:space:]{]|$)/) { rp = 1; if (s ~ app_addr) proxies = 1 }
        else if (s ~ /^to[[:space:]]/ && s ~ app_addr) proxies = 1
        else if (s ~ /^import[[:space:]]/ && s != imp && s != limits) unknown_import = 1
      }
      t = s; opens = gsub(/\{/, "", t)
      t = s; closes = gsub(/\}/, "", t)
      depth += opens - closes
      if (depth < 0) bad = 3
      if (depth == 0 && start) {
        decide()
        if (action == "import") add[start] = imp
        if (action == "redir") add[start] = redir
        print b_addrs " | " label " | proxies to the app: " (proxies ? "yes" : "no") " | adds: " action > layout
        start = 0
      }
    }
    END {
      close(layout)
      if (bad || depth != 0 || pending != "") exit 3
      if (order) exit 8
      if (mixed) exit 7
      if (mixed_plain) exit 9
      if (unclear) exit 10
      if (!domains) exit 4
      if (ipaddr != "") { gsub(/^[[:space:]]+|[[:space:]]+$/, "", ipaddr); print ipaddr > side }
      for (i = 1; i <= NR; i++) {
        print text[i]
        if (i in add) {
          indent = "\t"
          if ((i + 1) in text && match(text[i + 1], /^[[:space:]]+/)) indent = substr(text[i + 1], 1, RLENGTH)
          print indent add[i]
        }
      }
    }' "$CADDYFILE"
}

# Status, Location and Strict-Transport-Security of a request through Caddy on this machine.
headers_of() { # <url> [curl args…]
  local target="$1"
  shift
  { curl -s -o /dev/null -D - --max-time 15 "$@" "$target" 2>/dev/null || true; } | tr -d '\r' | awk '
    NR == 1 { code = $2 }
    tolower($1) == "location:" { loc = $2 }
    tolower($1) == "strict-transport-security:" { sub(/^[^:]*:[[:space:]]*/, ""); hsts = $0 }
    END { printf "%s|%s|%s\n", code ? code : "000", loc, hsts }'
}
field() { cut -d'|' -f"$1" <<<"$2"; }
domain_headers() { headers_of "https://$host/" --resolve "$host:443:127.0.0.1"; }
http_headers() { headers_of "http://$host/login" --resolve "$host:80:127.0.0.1"; }

ip_address=""
# The IP a visitor would type: the one the plain-HTTP block names, else this server's first
# public IPv4 (SERVER_IP overrides), else 127.0.0.1, which a `:80` catch-all answers.
probe_ip() {
  local ip
  ip=$(grep -oE '[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+' <<<"$ip_address" | head -n 1 || true)
  [ -n "$ip" ] || ip="${SERVER_IP:-}"
  if [ -z "$ip" ]; then
    ip=$({ hostname -I 2>/dev/null || true; } | tr ' ' '\n' |
      grep -E '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$' |
      grep -vE '^(127\.|10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[01])\.|169\.254\.)' | head -n 1 || true)
  fi
  echo "${ip:-127.0.0.1}"
}
ip_headers() { headers_of "http://127.0.0.1/login" -H "Host: $(probe_ip)"; }
# True when plain HTTP to the IP reaches the app: its /api/version answers with a build ID.
# Caddy itself answers an empty 200 for a host no site serves, which is not the app.
ip_reaches_app() {
  { curl -s --max-time 15 -H "Host: $(probe_ip)" "http://127.0.0.1/api/version" 2>/dev/null || true; } |
    grep -q '"buildId"'
}
# One line saying what the IP request was and what came back, for the annotations. The IP is
# public (and the deploy log masks the VPS_HOST secret anyway); nothing else is printed.
ip_probe_text() {
  local i app loc
  i=$(ip_headers)
  if ip_reaches_app; then app="the app answered (/api/version gave a build ID)"; else app="not the app"; fi
  loc=$(field 2 "$i")
  echo "IP request: GET http://127.0.0.1:80/login with Host: $(probe_ip) → $(field 1 "$i")${loc:+, Location: $loc}; $app"
}

# Prints why plain HTTP to the IP is not safe, or nothing. Safe: a permanent redirect to the same
# path on the HTTPS domain, no answer at all, or an answer that isn't the app.
ip_problem() {
  local i
  i=$(ip_headers)
  case "$(field 1 "$i")" in
    000) return 0 ;;
    308) [ "$(field 2 "$i")" = "https://$host/login" ] && return 0 ;;
  esac
  ip_reaches_app || return 0
  echo "plain HTTP to the IP reaches the app (answers $(field 1 "$i")) instead of redirecting to https://$host/login"
}

# A read-only summary of how Caddy itself reads the live Caddyfile, from `caddy adapt`: for each
# server, its listen addresses, and for each route its host matchers and the handlers in order.
# Only names, hosts and upstream addresses: no header values, matchers' other fields or options.
caddy_summary() { # <caddyfile>
  { caddy adapt --config "$1" --adapter caddyfile 2>/dev/null || true; } | node -e '
    let raw = ""
    process.stdin.on("data", (d) => (raw += d)).on("end", () => {
      let cfg
      try { cfg = JSON.parse(raw) } catch { console.log("caddy adapt gave no readable output"); return }
      const names = (handlers = []) => handlers.map((h) => {
        if (h.handler === "subroute") return "subroute[" + (h.routes || []).map(route).join("; ") + "]"
        if (h.handler === "reverse_proxy") return "reverse_proxy(" + (h.upstreams || []).map((u) => u.dial).join(",") + ")"
        if (h.handler === "static_response") return "static_response(" + (h.status_code ?? 200) + ")"
        return h.handler
      }).join(" > ")
      const route = (r) => {
        const hosts = (r.match || []).flatMap((m) => m.host || [])
        const paths = (r.match || []).some((m) => m.path) ? " (path match)" : ""
        return (hosts.length ? hosts.join(",") : "any host") + paths + ": " + names(r.handle)
      }
      const servers = cfg?.apps?.http?.servers || {}
      for (const [name, s] of Object.entries(servers)) {
        console.log(name + " listens on " + (s.listen || []).join(",") + (s.automatic_https?.disable ? " (automatic HTTPS off)" : ""))
        for (const r of s.routes || []) console.log("  " + route(r))
      }
      if (!Object.keys(servers).length) console.log("no http servers in the adapted config")
    })' 2>/dev/null | cut -c1-300 | head -n 30
}

# What must hold, changed or not: the site answers, the domain sends the HSTS header, and plain
# HTTP to the domain and to the IP redirects permanently to the same path on the HTTPS domain.
# Prints the first problem, or nothing.
problem_now() {
  local d h
  wait_until_up 20 || { echo "the site does not answer through Caddy"; return; }
  d=$(domain_headers)
  [ "$(field 3 "$d")" = "$hsts_value" ] ||
    { echo "https://$host/ does not send Strict-Transport-Security: $hsts_value"; return; }
  h=$(http_headers)
  case "$(field 1 "$h")" in 301 | 308) ;; *) h="" ;; esac
  [ -n "$h" ] && [ "$(field 2 "$h")" = "https://$host/login" ] ||
    { echo "plain HTTP to $host does not redirect permanently to https://$host/login"; return; }
  ip_problem
}

# Everything needed to tell from the deploy run why the check failed, without SSH, in one
# annotation: the site blocks as the script read them, the IP request and its answer, and how
# Caddy reads the Caddyfile that was live when the check ran.
# The IP request line and the `caddy adapt` summary are passed in, so that after a change they
# can be captured while the change, and the files it imports, are still in place.
report_details() { # <level> <IP request line> <caddy adapt summary>
  {
    echo "Site blocks in $CADDYFILE (addresses | taken for | proxies to the app | adds):"
    if [ -s "$layout_file" ]; then sed 's/^/  /' "$layout_file"; else echo "  (none read)"; fi
    echo "$2"
    echo "How Caddy reads the checked Caddyfile (caddy adapt; automatic HTTP->HTTPS redirects are added at runtime and not shown):"
    sed 's/^/  /' <<<"$3"
  } | report_lines "$1" "Caddy HTTPS details"
}

status=0
rewrite >"$candidate" || status=$?
if [ "$status" -ne 0 ]; then
  case $status in
    4) why="no Caddy site block serves $host over HTTPS" ;;
    7) why="a Caddy site block serves $host together with other addresses" ;;
    8) why="the Caddyfile sets a global 'order', which can run reverse_proxy before redir" ;;
    9) why="a Caddy site block that proxies to the app serves plain HTTP and HTTPS together" ;;
    10) why="a plain-HTTP Caddy site block for another host may serve the app (its proxy target or an import can't be read)" ;;
    *) why="the Caddyfile's layout wasn't recognised (a heredoc, a site block on one line, or unbalanced braces)" ;;
  esac
  # A block that may serve sign-in over plain HTTP can't be checked from here (its host isn't
  # known), so it fails rather than pass on the IP check alone.
  if [ "$status" -eq 10 ]; then
    report "ERROR: $why, so the Caddyfile was left alone; check that block, and add the redirect by hand if it serves the app (ops/README.md, Caddy HTTPS)"
    report_details error "$(ip_probe_text)" "$(caddy_summary "$CADDYFILE")"
    exit 1
  fi
  # Left alone, but the IP must still not reach the app.
  problem=$(ip_problem)
  if [ -n "$problem" ]; then
    report "ERROR: $why, so it was left alone, and $problem; add the redirect by hand (ops/README.md, Caddy HTTPS)"
    report_details error "$(ip_probe_text)" "$(caddy_summary "$CADDYFILE")"
    exit 1
  fi
  report "WARNING: $why, so the Caddyfile was left alone (plain HTTP to the IP does not reach the app)"
  report_details warning "$(ip_probe_text)" "$(caddy_summary "$CADDYFILE")"
  exit 0
fi
ip_address=$(cat "$ip_address_file" 2>/dev/null || true)

# The new Caddyfile may differ from the old one only by added import and redirect lines.
# Compare against a copy that ends with a newline, since the rewritten file always does.
sed -e '$a\' "$CADDYFILE" >"$original"
changes=$(diff --unchanged-line-format= --old-line-format='-%L' --new-line-format='+%L' \
  "$original" "$candidate" || true)
removed=$(sed -n 's/^-//p' <<<"$changes")
added=$(sed -n 's/^+[[:space:]]*//p' <<<"$changes")
added_count=$(grep -c . <<<"$added" || true)
redirects=$(grep -cxF "$REDIR_LINE" <<<"$added" || true)
imports=$(grep -cxF "$IMPORT_LINE" <<<"$added" || true)
if [ -n "$removed" ] || [ "$((redirects + imports))" -ne "$added_count" ]; then
  report "ERROR: the Caddyfile edit changed more than adding the HSTS import and the HTTP redirects; nothing was changed"
  exit 1
fi

hsts_changed=no
if ! cmp -s "$SOURCE" "$HSTS_FILE"; then hsts_changed=yes; fi
caddyfile_changed=no
if [ "$added_count" -gt 0 ]; then caddyfile_changed=yes; fi

# Copies <src> to <dst> under a temporary name in <dst>'s folder, checks the copy is identical,
# then renames it into place, so <dst> is never half written and a partial copy never counts.
# With a third argument, <dst> takes that file's owner and mode.
safe_copy() { # <src> <dst> [reference]
  local tmp
  tmp=$(mktemp "$2.sprecher-east-tmp-XXXXXX") || return 1
  if cp "$1" "$tmp" && cmp -s "$1" "$tmp" &&
    { [ -z "${3:-}" ] || { chown --reference="$3" "$tmp" && chmod --reference="$3" "$tmp"; }; } &&
    mv -f "$tmp" "$2"; then
    return 0
  fi
  rm -f "$tmp"
  return 1
}

# What the script has done so far, so a rollback puts back exactly that and nothing else.
backup=""            # the verified dated backup of the Caddyfile
replaced=no          # yes once the Caddyfile has been replaced
hsts_previous=""     # a verified copy of the HSTS file as it was, if there was one
hsts_installed=no    # yes once the HSTS file has been replaced or created

# Puts back what was replaced and reloads. On failure, prints what went wrong.
restore_all() {
  local failed=""
  if [ "$replaced" = yes ] && ! safe_copy "$backup" "$CADDYFILE" "$CADDYFILE"; then
    failed="the Caddyfile (backup: $backup)"
  fi
  if [ "$hsts_installed" = yes ]; then
    if [ -n "$hsts_previous" ]; then
      if safe_copy "$hsts_previous" "$HSTS_FILE" "$HSTS_FILE"; then
        rm -f "$hsts_previous"
      else
        failed="${failed:+$failed and }the HSTS file (copy: $hsts_previous)"
      fi
    else
      rm -f "$HSTS_FILE" || failed="${failed:+$failed and }the HSTS file"
    fi
  fi
  if [ -n "$failed" ]; then
    echo "Could not put back $failed."
    return 1
  fi
  if ! $RELOAD_CADDY >/dev/null 2>&1; then
    echo "The previous files are back, but Caddy would not reload them."
    return 1
  fi
}

# From the first change until the check passes, any unexpected failure puts back what changed.
on_unexpected_error() {
  [ "$BASH_SUBSHELL" -eq 0 ] || return 0
  trap - ERR
  local detail
  if [ "$replaced" = no ] && [ "$hsts_installed" = no ]; then
    report "ERROR: caddy-https.sh failed unexpectedly at line $1; nothing was changed"
  elif detail=$(restore_all); then
    report "ERROR: caddy-https.sh failed unexpectedly at line $1; the previous Caddy config is back"
  else
    report "ERROR: caddy-https.sh failed unexpectedly at line $1. $detail"
  fi
  exit 1
}

if [ "$caddyfile_changed" = no ] && [ "$hsts_changed" = no ]; then
  problem=$(problem_now)
  if [ -n "$problem" ]; then
    report "ERROR: Caddy's HTTPS settings look in place, but $problem; nothing was changed"
    report_details error "$(ip_probe_text)" "$(caddy_summary "$CADDYFILE")"
    exit 1
  fi
  report "Caddy HTTPS settings already in place (HSTS $hsts_value, Caddy $(caddy_version))"
else
  # Backups first, each verified before anything is changed.
  if [ "$caddyfile_changed" = yes ]; then
    backup="$CADDYFILE.bak-$stamp"
    safe_copy "$CADDYFILE" "$backup" "$CADDYFILE"
    safe_copy "$CADDYFILE" "$CADDYFILE.bak" "$CADDYFILE"
  fi
  if [ "$hsts_changed" = yes ] && [ -f "$HSTS_FILE" ]; then
    hsts_previous="$HSTS_FILE.previous-$stamp"
    safe_copy "$HSTS_FILE" "$hsts_previous" "$HSTS_FILE"
  fi

  if [ "$hsts_changed" = yes ]; then
    hsts_installed=yes # set first: a half-done install still gets undone
    safe_copy "$SOURCE" "$HSTS_FILE"
    chmod 644 "$HSTS_FILE"
  fi
  if ! caddy_accepts "$candidate"; then
    if detail=$(restore_all); then
      report "ERROR: Caddy rejected the HSTS and HTTP redirect change; nothing was changed"
    else
      report "ERROR: Caddy rejected the change. $detail"
    fi
    exit 1
  fi
  if [ "$caddyfile_changed" = yes ]; then
    safe_copy "$candidate" "$CADDYFILE" "$CADDYFILE"
    replaced=yes
  fi

  problem=""
  if ! $RELOAD_CADDY >/dev/null 2>&1; then
    problem="Caddy would not reload with the HSTS and HTTP redirect change"
  else
    problem=$(problem_now)
  fi
  if [ -n "$problem" ]; then
    # What the IP got while the change was live, measured before the rollback (only when the
    # site still answers, so a site that is down isn't kept down while it's measured).
    probe="IP request: not made (the site did not answer)"
    case "$problem" in *"the site does not answer"* | *"would not reload"*) ;; *) probe=$(ip_probe_text) ;; esac
    # How Caddy reads the changed Caddyfile, while it and the files it imports (the new HSTS
    # snippet included) are still in place: `caddy adapt` only reads files, so this is quick.
    summary=$(caddy_summary "$CADDYFILE")
    if detail=$(restore_all); then
      report "ERROR: $problem; the previous Caddy config is back"
    else
      report "ERROR: $problem. $detail"
    fi
    report_details error "$probe" "$summary"
    exit 1
  fi
  trap - ERR
  [ -z "$hsts_previous" ] || rm -f "$hsts_previous"
  if [ "$caddyfile_changed" = yes ]; then
    report "Caddy HTTPS settings applied: $imports HSTS import(s), $redirects HTTP redirect(s) (backup: $backup)"
  else
    report "Caddy HSTS updated: $hsts_value"
  fi
fi

# Evidence for #235, as `curl -I` sees it from this server through Caddy, in one annotation.
d=$(domain_headers)
h=$(http_headers)
{
  echo "curl -I https://$host/ → $(field 1 "$d"), Strict-Transport-Security: $(field 3 "$d")"
  echo "curl -I http://$host/login → $(field 1 "$h") to $(field 2 "$h")"
  ip_probe_text
  echo "Site blocks (addresses | taken for | proxies to the app | adds):"
  sed 's/^/  /' "$layout_file"
} | report_lines notice "Caddy HTTPS evidence"
if [ -z "$ip_address" ]; then
  report "WARNING: no plain-HTTP Caddy site block for the IP was recognised; plain HTTP to the IP was checked directly and does not reach the app"
fi
