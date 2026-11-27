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
OFFSITE_RUN_SECONDS=21600
OFFSITE_QUICK_SECONDS=240

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

# Prints why <certificate file> cannot be used to seal, and returns 1; prints nothing when it can. It must be
# one PEM certificate (the public half only: a private key is refused whatever else the file holds), and its public
# key must pass the same rule as every public key the repo seals to (public-key-lib.sh). A certificate that has
# expired is accepted: openssl does not check the dates when it seals, and only the key matters here.
offsite_cert_problem() { # <file>
  local file="$1" pub
  if [ ! -f "$file" ] || [ -L "$file" ]; then
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
  if ! openssl x509 -in "$file" -noout -pubkey >"$pub" 2>/dev/null; then
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
  if [[ "${val[token]}" != "{"*"}" ]]; then
    OFFSITE_CONF_PROBLEM="the credential's token is not the sign-in token rclone wrote"
    return 1
  fi
  printf -v OFFSITE_CONF_CANONICAL '[%s]\ntype = drive\nclient_id = %s\nclient_secret = %s\nscope = drive.file\ntoken = %s\n' \
    "$OFFSITE_REMOTE_NAME" "${val[client_id]}" "${val[client_secret]}" "${val[token]}"
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
