# shellcheck shell=bash
# Shared by the off-site backup scripts (#1332): the settings that must agree between the job that
# seals and uploads (offsite-backup.sh), the installer (install-offsite-backup.sh) and the restore
# script the owner runs on his own computer (offsite-restore.sh), and the sealing itself. Sourced,
# never run. It needs only bash and openssl, so the restore script can use it on any computer.
#
# The scheme is CMS (RFC 5083, AuthEnvelopedData), made by `openssl cms`: a random key per archive,
# the archive encrypted with AES-256-GCM (an authenticated cipher: a changed byte makes opening fail),
# and that key sealed to the owner's RSA public key with RSA-OAEP and SHA-256, the same sealing the repo
# already does for sign-in details (.github/scripts/preview-credentials.sh). The server holds only the
# public half, in `ops/offsite-backup-cert.pem` (a self-signed certificate that carries nothing but the public key
# and a fixed name), so it cannot open what it made. The private key lives in the owner's password manager.
# shellcheck disable=SC2034 # the scripts that source this file use what it sets

# Where the copies go: an rclone remote named `offsite` (the section name in the rclone config the deploy
# writes, ops/install-offsite-backup.sh) and one folder in it. With the drive.file scope that folder is created
# by the job itself and the job sees nothing else in the Drive.
OFFSITE_REMOTE_NAME="${OFFSITE_REMOTE_NAME:-offsite}"
OFFSITE_REMOTE_DIR="${OFFSITE_REMOTE_DIR:-sprecher-east-backups}"
OFFSITE_REMOTE="$OFFSITE_REMOTE_NAME:$OFFSITE_REMOTE_DIR"

# Root-only settings of the job, outside the repository and outside the app's folders.
OFFSITE_DIR="${OFFSITE_DIR:-/etc/sprecher-east}"
OFFSITE_RCLONE_CONF="${OFFSITE_RCLONE_CONF:-$OFFSITE_DIR/offsite-rclone.conf}"
OFFSITE_CRON_FILE="${OFFSITE_CRON_FILE:-/etc/cron.d/sprecher-east-offsite-backup}"
OFFSITE_LOG="${OFFSITE_LOG:-/var/log/sprecher-east-offsite-backup.log}"

# The rule for how many and how old (the owner's plan of 2026-11-20, recorded on #1332): the newest eight
# weekly copies stay in Drive, and the check calls the newest copy too old after eight days.
OFFSITE_KEEP="${OFFSITE_KEEP:-8}"
OFFSITE_MAX_AGE_DAYS="${OFFSITE_MAX_AGE_DAYS:-8}"
# The newest daily archive the job may seal is at most this many hours old: a weekly copy of a stale archive
# would look like a fresh one.
OFFSITE_MAX_ARCHIVE_HOURS="${OFFSITE_MAX_ARCHIVE_HOURS:-36}"

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

# The RSA key the copies are sealed to must be at least this strong (and no more than a sane size).
OFFSITE_MIN_KEY_BITS=3072
OFFSITE_MAX_KEY_BITS=8192

# Prints why <certificate file> cannot be used to seal, and returns 1; prints nothing when it can. It must
# be one PEM certificate (the public half only: a private key is refused whatever else the file holds) with
# an RSA key of a sound size.
offsite_cert_problem() { # <file>
  local file="$1" text bits
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
  if ! text=$(openssl x509 -in "$file" -noout -text 2>/dev/null); then
    echo "the public key file is not a readable certificate"
    return 1
  fi
  if [[ "$text" != *"Public Key Algorithm: rsaEncryption"* ]] || ! [[ "$text" =~ Public-Key:\ \(([0-9]+)\ bit\) ]]; then
    echo "the public key is not an RSA key"
    return 1
  fi
  bits=${BASH_REMATCH[1]}
  if [ "$bits" -lt "$OFFSITE_MIN_KEY_BITS" ] || [ "$bits" -gt "$OFFSITE_MAX_KEY_BITS" ]; then
    echo "the RSA key must be between $OFFSITE_MIN_KEY_BITS and $OFFSITE_MAX_KEY_BITS bits"
    return 1
  fi
  return 0
}

# Seals <in> to <certificate> into <out>. openssl's own words are never shown: they could name a path.
offsite_seal() { # <certificate> <in> <out>
  openssl cms -encrypt -aes-256-gcm -binary -stream -outform DER -in "$2" -out "$3" \
    -recip "$1" -keyopt rsa_padding_mode:oaep -keyopt rsa_oaep_md:sha256 -keyopt rsa_mgf1_md:sha256 2>/dev/null
}

# Opens a sealed copy with the private key (openssl asks for its passphrase, on the terminal, when it has one).
# The authentication tag is checked, so a copy that was changed fails; the caller removes <out> then, because it
# can hold output written before the failure was seen.
offsite_open() { # <private key> <sealed in> <out>
  openssl cms -decrypt -binary -inform DER -in "$2" -inkey "$1" -out "$3"
}
