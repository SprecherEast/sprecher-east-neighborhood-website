# shellcheck shell=bash
# Shared by the off-site backup scripts (#1332): the settings that must agree between the job that
# seals and uploads (offsite-backup.sh), the installer (install-offsite-backup.sh) and the restore
# script the owner runs on his own computer (offsite-restore.sh), and the sealing itself. Sourced,
# never run. The server's file locations are in environment.sh (OFFSITE_DIR and the rest); the server
# scripts get them from lib.sh. The restore script needs only bash and OpenSSL 3, so this file, public-key-lib.sh and
# the restore script are all it takes on his computer.
#
# The scheme is CMS (RFC 5083, AuthEnvelopedData), made by `openssl cms`: a random key per archive,
# the archive encrypted with AES-256-GCM (an authenticated cipher: a changed byte makes opening fail),
# and that key sealed to the owner's RSA public key with RSA-OAEP and SHA-256, the same sealing the repo
# already does for sign-in details (.github/scripts/preview-credentials.sh). The server holds only the
# public half, in `ops/offsite-backup-cert.pem` (a self-signed certificate that carries nothing but the public key
# and a fixed name), so it cannot open what it made. The private key lives in the owner's password manager.
# shellcheck disable=SC2034 # the scripts that source this file use what it sets

# shellcheck source=public-key-lib.sh
. "$(dirname "${BASH_SOURCE[0]}")/public-key-lib.sh"

# The one openssl and the one rclone every script uses, and the public certificate the copies are sealed to.
OFFSITE_OPENSSL="${OFFSITE_OPENSSL:-openssl}"
RCLONE="${RCLONE:-rclone}"
[ -z "${CODE_DIR:-}" ] || OFFSITE_CERT="${OFFSITE_CERT:-$CODE_DIR/ops/offsite-backup-cert.pem}"

# Where the copies go: an rclone remote named `offsite` (the section name in the rclone config the deploy
# writes, ops/install-offsite-backup.sh) and one folder in it. With the drive.file scope that folder is created
# by the job itself and the job sees nothing else in the Drive.
OFFSITE_REMOTE_NAME="offsite"
OFFSITE_REMOTE_DIR="sprecher-east-backups"
OFFSITE_REMOTE="$OFFSITE_REMOTE_NAME:$OFFSITE_REMOTE_DIR"

# The rule for how many and how old (the owner's plan of 2026-11-20, recorded on #1332): the newest eight
# weekly copies stay in Drive, and the check calls the newest copy too old after eight days.
OFFSITE_KEEP="${OFFSITE_KEEP:-8}"
OFFSITE_TEST_KEEP=1 # test files from the installer's first try
OFFSITE_MAX_AGE_DAYS="${OFFSITE_MAX_AGE_DAYS:-8}"
# The newest daily archive the job may seal is at most this many hours old: a weekly copy of a stale archive
# would look like a fresh one.
OFFSITE_MAX_ARCHIVE_HOURS="${OFFSITE_MAX_ARCHIVE_HOURS:-36}"
OFFSITE_SPARE_KB="${OFFSITE_SPARE_KB:-1048576}" # free space to keep beside the sealed copy: 1 GB
# OpenSSL does not stream the opening of a copy: the owner's computer needs about OFFSITE_OPEN_MEMORY_FACTOR times
# the copy's size in free memory (measured 2026-11-26: about 3 times, 600 MB for a 200 MB copy). Above this size the job warns.
OFFSITE_OPEN_MEMORY_FACTOR=3
OFFSITE_WARN_BYTES="${OFFSITE_WARN_BYTES:-1073741824}"
# How long one rclone call may take before it is cut off: a run sends a whole archive, the test and the check
# (which a deploy waits for) must not hang it.
OFFSITE_RUN_SECONDS="${OFFSITE_RUN_SECONDS:-21600}"
OFFSITE_QUICK_SECONDS="${OFFSITE_QUICK_SECONDS:-60}"
# What the deploy's step may spend (its limit is 15 minutes, .github/workflows/deploy.yml; a test adds these up): the
# package download, the first try (`test`) and the check, each cut off as a whole, and Google's one token-info call.
OFFSITE_DOWNLOAD_SECONDS="${OFFSITE_DOWNLOAD_SECONDS:-180}"
OFFSITE_TEST_TOTAL_SECONDS="${OFFSITE_TEST_TOTAL_SECONDS:-300}"
OFFSITE_CHECK_TOTAL_SECONDS="${OFFSITE_CHECK_TOTAL_SECONDS:-120}"
OFFSITE_TOKENINFO_SECONDS=20
# Google's endpoint that says what an access token was granted. The file's own `scope` line says nothing about that:
# Google fixes the scope when the owner signs in.
OFFSITE_TOKENINFO_URL="https://oauth2.googleapis.com/tokeninfo"
OFFSITE_SCOPE="https://www.googleapis.com/auth/drive.file"

# What a sealed copy is called, and what the job may ever delete in Drive: nothing else matches these.
OFFSITE_SUFFIX=".cms"
OFFSITE_ARCHIVE_PATTERN='^sprecher-east-[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{4}Z\.tar\.gz\.cms$'
OFFSITE_TEST_PATTERN='^sprecher-east-test-[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{4}Z\.txt\.cms$'

# The rclone release the installer puts on the server: pinned, with the SHA-256 of each package from rclone's
# own SHA256SUMS (https://downloads.rclone.org/v1.76.0/SHA256SUMS, and the same file on the GitHub release;
# the two agree). Changing the version means changing these lines and the test that reads them.
OFFSITE_RCLONE_VERSION="1.76.0"
OFFSITE_RCLONE_SHA256_AMD64="9db7ee9b725bce7cdd195b9183449a4c6fb93cad3e6578e70b87c0bc7f6062e9"
OFFSITE_RCLONE_SHA256_ARM64="c486d404ecbc4bb3d54052a0efaf9e652cf0d2c645e4523f7a2aefa112fe029c"
OFFSITE_RCLONE_URL="${OFFSITE_RCLONE_URL:-https://downloads.rclone.org}"

# Prints why the OpenSSL in use cannot make or open a copy, and returns 1; prints nothing when it can. AuthEnvelopedData
# with AES-GCM in `openssl cms` needs OpenSSL 3.0 or later. LibreSSL, which macOS ships as `openssl`, does not have it.
offsite_openssl_problem() {
  local banner
  banner=$("$OFFSITE_OPENSSL" version 2>/dev/null | head -n 1) || banner=""
  if [[ "$banner" =~ ^OpenSSL\ ([0-9]+)\. ]] && [ "${BASH_REMATCH[1]}" -ge 3 ]; then
    return 0
  fi
  echo "this needs OpenSSL 3.0 or later, and \"$OFFSITE_OPENSSL\" is: ${banner:0:60}"
  return 1
}

# Is there anything at <path>, even a link that leads nowhere? ("not there yet" is for nothing at all; a link is a problem.)
offsite_cert_present() { # <file>
  [ -e "$1" ] || [ -L "$1" ]
}

# Prints why <certificate file> cannot be used to seal, and returns 1; prints nothing when it can. It must be
# one PEM certificate (the public half only: a private key is refused whatever else the file holds), and its public
# key must pass the same rule as every public key the repo seals to (public-key-lib.sh). A certificate that has
# expired is accepted: openssl does not check the dates when it seals, and only the key matters here.
offsite_cert_problem() { # <file>
  local file="$1" pub
  if [ -L "$file" ]; then
    echo "the public key file is a symbolic link; it must be the certificate itself"
    return 1
  fi
  if [ ! -f "$file" ]; then
    echo "the public key file is missing"
    return 1
  fi
  if [ "$(wc -c <"$file")" -gt 8192 ] || grep -q 'PRIVATE' "$file"; then
    echo "the public key file holds more than a public certificate (a private key must never be here)"
    return 1
  fi
  if [ "$(head -n 1 "$file")" != "-----BEGIN CERTIFICATE-----" ] || [ "$(grep -c -- '-----BEGIN' "$file")" != 1 ]; then
    echo "the public key file is not exactly one PEM certificate"
    return 1
  fi
  pub=$(mktemp)
  if ! "$OFFSITE_OPENSSL" x509 -in "$file" -noout -pubkey >"$pub" 2>/dev/null; then
    rm -f "$pub"
    echo "the public key file is not a readable certificate"
    return 1
  fi
  if ! public_key_problem "$pub"; then
    rm -f "$pub"
    echo "$PUBLIC_KEY_PROBLEM"
    return 1
  fi
  rm -f "$pub"
  return 0
}

# Reads a Drive credential (an rclone config section) as text, and either sets OFFSITE_CONF_CANONICAL to the file the
# server stores, or sets OFFSITE_CONF_PROBLEM to why not and returns 1. The file stored is written from the values
# checked here, never the text received, so nothing rclone could read differently (a setting given twice, of which
# it keeps the last; another spelling; Windows line endings; a second section) can reach it. Exactly one [offsite]
# section, each of type, client_id, client_secret, scope and token once, type drive, scope drive.file (so the job can
# see only the files it makes itself), and nothing else but the empty team_drive, root_folder_id and
# service_account_file lines rclone writes for a personal Drive. A value is never put in a message.
offsite_conf_normalize() { # <text>
  local -A val=()
  local line key value sections=0 inside=no need
  OFFSITE_CONF_CANONICAL=""
  OFFSITE_CONF_PROBLEM=""
  while IFS= read -r line || [ -n "$line" ]; do
    # trimming white space takes a Windows line ending's carriage return too
    line=${line#"${line%%[![:space:]]*}"}
    line=${line%"${line##*[![:space:]]}"}
    case "$line" in
      "" | "#"* | ";"*) continue ;;
      "[$OFFSITE_REMOTE_NAME]")
        sections=$((sections + 1))
        if [ "$sections" -gt 1 ]; then
          OFFSITE_CONF_PROBLEM="the credential has more than one [$OFFSITE_REMOTE_NAME] section"
          return 1
        fi
        inside=yes
        ;;
      "["*)
        OFFSITE_CONF_PROBLEM="the credential has a section other than [$OFFSITE_REMOTE_NAME]"
        return 1
        ;;
      *=*)
        if [ "$inside" != yes ]; then
          OFFSITE_CONF_PROBLEM="the credential has a setting before the [$OFFSITE_REMOTE_NAME] section"
          return 1
        fi
        key=${line%%=*}
        key=${key%"${key##*[![:space:]]}"}
        value=${line#*=}
        value=${value#"${value%%[![:space:]]*}"}
        case "$key" in
          type | client_id | client_secret | scope | token | team_drive | root_folder_id | service_account_file) ;;
          *)
            # Only a plain setting name is shown, never anything that could be a value.
            [[ "$key" =~ ^[a-z_]{1,40}$ ]] || key="with an unreadable name"
            OFFSITE_CONF_PROBLEM="the credential has a setting ($key) that is not allowed"
            return 1
            ;;
        esac
        if [ -n "${val[$key]+set}" ]; then
          OFFSITE_CONF_PROBLEM="the credential sets $key more than once"
          return 1
        fi
        val[$key]=$value
        ;;
      *)
        OFFSITE_CONF_PROBLEM="the credential has a line that is not a setting"
        return 1
        ;;
    esac
  done <<<"$1"
  if [ "$sections" != 1 ] || [ "${val[type]:-}" != drive ]; then
    OFFSITE_CONF_PROBLEM="the credential must be one [$OFFSITE_REMOTE_NAME] section of type drive"
    return 1
  fi
  if [ "${val[scope]:-}" != drive.file ]; then
    OFFSITE_CONF_PROBLEM="the credential's scope must be drive.file (the job may see only the files it makes)"
    return 1
  fi
  for key in team_drive root_folder_id service_account_file; do
    if [ -n "${val[$key]:-}" ]; then
      OFFSITE_CONF_PROBLEM="the credential sets $key, which is not allowed"
      return 1
    fi
  done
  for need in client_id client_secret token; do
    if [ -z "${val[$need]:-}" ]; then
      OFFSITE_CONF_PROBLEM="the credential has no $need"
      return 1
    fi
  done
  if ! offsite_token_problem "${val[token]}"; then
    OFFSITE_CONF_PROBLEM="$OFFSITE_TOKEN_PROBLEM"
    return 1
  fi
  printf -v OFFSITE_CONF_CANONICAL '[%s]\ntype = drive\nclient_id = %s\nclient_secret = %s\nscope = drive.file\ntoken = %s\n' \
    "$OFFSITE_REMOTE_NAME" "${val[client_id]}" "${val[client_secret]}" "${val[token]}"
}

# Checks the `token` value of a credential the way rclone 1.76.0 reads it, and either returns 0 or sets
# OFFSITE_TOKEN_PROBLEM to a fixed sentence and returns 1 (a value is never in it). rclone needs one line of JSON with a
# non-empty access_token and refresh_token (with an empty access_token it falls back to an old format and blanks the
# refresh token) and an RFC 3339 expiry (with none the access token counts as never expiring and is never refreshed, so
# the credential works for about an hour). Google's own response to a sign-in (it has `expires_in` and no `expiry`) is not
# that shape and is refused. A fractional second in the expiry is valid. Node reads it (the server runs Node, as its
# backup does); the token goes in on stdin, never in an argument.
offsite_token_problem() { # <token value>
  local verdict
  OFFSITE_TOKEN_PROBLEM=""
  verdict=$(
    printf '%s' "$1" | node -e '
      let text = ""
      process.stdin.on("data", (d) => (text += d)).on("end", () => {
        let t
        try { t = JSON.parse(text) } catch { return console.log("json") }
        if (t === null || typeof t !== "object" || Array.isArray(t)) return console.log("json")
        const filled = (v) => typeof v === "string" && v.trim() !== ""
        if (!filled(t.access_token)) return console.log("access")
        if (!filled(t.refresh_token)) return console.log("refresh")
        if ("expires_in" in t && !("expiry" in t)) return console.log("raw")
        const rfc3339 = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/
        if (typeof t.expiry !== "string" || !rfc3339.test(t.expiry) || Number.isNaN(Date.parse(t.expiry))) return console.log("expiry")
        console.log("ok")
      })
    ' 2>/dev/null
  ) || verdict=node
  case "$verdict" in
    ok) return 0 ;;
    json) OFFSITE_TOKEN_PROBLEM="the credential's token must be one line of JSON, as rclone writes it" ;;
    access) OFFSITE_TOKEN_PROBLEM="the credential's token has no access_token" ;;
    refresh) OFFSITE_TOKEN_PROBLEM="the credential's token has no refresh_token" ;;
    raw) OFFSITE_TOKEN_PROBLEM="the credential's token is Google's raw sign-in response; it needs an expiry (an RFC 3339 date) instead of expires_in" ;;
    expiry) OFFSITE_TOKEN_PROBLEM="the credential's token needs an expiry that is an RFC 3339 date (for example 2026-11-27T06:03:00.123Z)" ;;
    *) OFFSITE_TOKEN_PROBLEM="the credential's token could not be checked (Node is needed on the server)" ;;
  esac
  return 1
}

# Asks Google what the access token in <credential file> was granted, and prints why it is not exactly drive.file (and
# returns 1), or prints nothing (returns 0). The file's `scope` line proves nothing: the narrow scope is set when the
# owner signs in, and a sign-in with full Drive access written as `scope = drive.file` would pass every other check. The
# token goes to Google over HTTPS in the request body (stdin), never in an argument, and no value is ever printed.
# Run after a first upload, so rclone has refreshed an expired access token into the file.
offsite_scope_problem() { # <credential file>
  local token answer verdict
  token=$(
    node -e '
      try {
        const m = /^token\s*=\s*(.*)$/m.exec(require("fs").readFileSync(process.argv[1], "utf8"))
        process.stdout.write(String(JSON.parse(m[1]).access_token || ""))
      } catch {}
    ' "$1" 2>/dev/null
  ) || token=""
  if ! [[ "$token" =~ ^[A-Za-z0-9._~-]+$ ]]; then
    echo "the stored access token could not be read, so the granted scope could not be checked"
    return 1
  fi
  answer=$(printf 'access_token=%s' "$token" | curl -fsS --proto '=https' --tlsv1.2 --max-time "$OFFSITE_TOKENINFO_SECONDS" \
    -d @- "$OFFSITE_TOKENINFO_URL" 2>/dev/null) || {
    echo "Google would not say what scope the credential was granted, so it was not accepted"
    return 1
  }
  verdict=$(
    printf '%s' "$answer" | node -e '
      let text = ""
      process.stdin.on("data", (d) => (text += d)).on("end", () => {
        try {
          const scopes = String(JSON.parse(text).scope || "").split(/\s+/).filter(Boolean)
          console.log(scopes.length === 1 && (scopes[0] === process.argv[1] || scopes[0] === "drive.file") ? "ok" : "wider")
        } catch { console.log("unreadable") }
      })
    ' "$OFFSITE_SCOPE" 2>/dev/null
  ) || verdict=unreadable
  case "$verdict" in
    ok) return 0 ;;
    wider) echo "the credential was granted more than drive.file (or something else); sign in again with only the drive.file scope" ;;
    *) echo "Google's answer about the granted scope could not be read, so the credential was not accepted" ;;
  esac
  return 1
}

# rclone reads settings from RCLONE_* environment variables ahead of its config file (a remote's type, its folder).
# Only root can set them and cron's environment is fixed, but the job's remote must be the file's and nothing else.
offsite_clear_rclone_environment() {
  local name
  while IFS= read -r name; do
    case "$name" in RCLONE_*) unset "$name" ;; esac
  done < <(compgen -e)
}

# Seals <in> to <certificate> into <out>. openssl's own words are never shown: they could name a path.
offsite_seal() { # <certificate> <in> <out>
  "$OFFSITE_OPENSSL" cms -encrypt -aes-256-gcm -binary -stream -outform DER -in "$2" -out "$3" \
    -recip "$1" -keyopt rsa_padding_mode:oaep -keyopt rsa_oaep_md:sha256 -keyopt rsa_mgf1_md:sha256 2>/dev/null
}

# Opens a sealed copy with the private key (openssl asks for its passphrase, on the terminal, when it has one).
# The authentication tag is checked, so a copy that was changed fails; the caller removes <out> then, because it
# can hold output written before the failure was seen. Sealing streams, opening does not: see OFFSITE_OPEN_MEMORY_FACTOR.
offsite_open() { # <private key> <sealed in> <out>
  "$OFFSITE_OPENSSL" cms -decrypt -binary -inform DER -in "$2" -inkey "$1" -out "$3"
}

# Is <name> a member the restore may take: the database file, the environment file, or a plain file or folder under
# media/ (never an absolute path, and no `.` or `..` part, nor a backslash or control character)?
offsite_member_name_ok() { # <name as tar lists it>
  local name="$1" rest part
  local -a parts
  # GNU tar lists a control character (a line break, a tab) as a backslash and a letter: a name with a backslash is refused.
  case "$name" in *\\*) return 1 ;; esac
  case "$name" in
    payload.db | env.local | media | media/) return 0 ;;
    media/*) ;;
    *) return 1 ;;
  esac
  rest=${name#media/}
  rest=${rest%/}
  [ -n "$rest" ] || return 1
  IFS=/ read -r -a parts <<<"$rest"
  for part in "${parts[@]}"; do
    case "$part" in "" | . | ..) return 1 ;; esac
  done
}

# Prints why the opened archive <file> may not be put on the server, and returns 1; prints nothing when every member is
# the database file, the environment file, or a plain file or folder under media/. Anything else (a link, a device, a
# pipe, a setuid or sticky bit, an absolute or parent path, another name) is refused: whoever can write to the Drive
# folder can make a copy that opens (the certificate is public) and passes the authentication check, so what is in it is
# checked here, not trusted. Both listings are read, and each line of the long one must begin with a plain file or folder
# type and permissions and end with the name the short one gives, so a name with a line break in it cannot pass.
offsite_archive_problem() { # <file>
  local names long i name line type
  local -a n_list l_list
  names=$(tar -tzf "$1" 2>/dev/null && printf x) || { echo "the copy opened but is not a readable archive"; return 1; }
  long=$(tar -tvzf "$1" 2>/dev/null && printf x) || { echo "the copy opened but is not a readable archive"; return 1; }
  names=${names%x}
  long=${long%x}
  mapfile -t n_list <<<"${names%$'\n'}"
  mapfile -t l_list <<<"${long%$'\n'}"
  if [ "${#n_list[@]}" != "${#l_list[@]}" ] || [ -z "$names" ]; then
    echo "the archive's member list could not be read safely"
    return 1
  fi
  local has_db=no
  for i in "${!n_list[@]}"; do
    name=${n_list[$i]}
    line=${l_list[$i]}
    if ! offsite_member_name_ok "$name"; then
      echo "the archive holds a member that is not the database, the environment file or a file under media/ (a name, a link or a path that must not be restored)"
      return 1
    fi
    if ! [[ "$line" =~ ^([-d])[-rwx]{9}[[:space:]] ]] || [[ "$line" != *" $name" ]]; then
      echo "the archive holds a member that is not a plain file or folder with ordinary permissions (a link, a device, a setuid bit)"
      return 1
    fi
    type=${BASH_REMATCH[1]}
    case "$name" in
      */ | media) [ "$type" = d ] || { echo "the archive holds a folder name that is not a folder"; return 1; } ;;
      *) [ "$type" = - ] || { echo "the archive holds a file name that is not a plain file"; return 1; } ;;
    esac
    [ "$name" != payload.db ] || has_db=yes
  done
  if [ "$has_db" != yes ]; then
    echo "the archive has no payload.db (the database)"
    return 1
  fi
  return 0
}
