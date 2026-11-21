#!/usr/bin/env bash
# Hands a pull request preview's test sign-in to whoever asked, without a public trace (#1394, part of #1077).
# Run by the `preview-sign-in` workflow, in the `preview` environment, from main's copy of the scripts, after
# `ssh vps` was set up by .github/actions/vps-ssh. The run log, the artifacts and every comment are public, so
# the passwords never leave this script in the clear: it asks the wrapper's `credentials` action
# (ops/preview-wrapper.sh), seals what comes back with the requester's one-time PUBLIC key (RSA-OAEP with
# SHA-256, plain `openssl`), and prints only the ciphertext. Only the holder of the private half can read it.
#
# The plaintext is also masked (`::add-mask::`, per line and per password) before anything else could print it,
# so a later mistake shows `***`. Nothing here turns tracing on, and a failure prints a fixed text: not the
# plaintext, not the key, not openssl's or ssh's own words.
#
# Environment: NUMBER (the pull request's number), PUBLIC_KEY_B64 (the requester's public key in PEM, as one
# line of base64) and optionally OPS_DIR (main's ops folder, default ops).
# Opening the result, on the requester's machine:
#   <the log line> | base64 -d | openssl pkeyutl -decrypt -inkey private.pem \
#     -pkeyopt rsa_padding_mode:oaep -pkeyopt rsa_oaep_md:sha256 -pkeyopt rsa_mgf1_md:sha256
set -euo pipefail
set +x

: "${NUMBER:?}" "${PUBLIC_KEY_B64:?}"
OPS_DIR="${OPS_DIR:-ops}"
# shellcheck source=../../ops/environment.sh
. "$OPS_DIR/environment.sh"
# shellcheck source=../../ops/preview-access-lib.sh
. "$OPS_DIR/preview-access-lib.sh"

# Below this the key is not worth sealing to, and a smaller one would not hold the file anyway (OAEP with
# SHA-256 takes the key's bytes minus 66).
MIN_KEY_BITS=3072
MAX_KEY_BITS=8192
OAEP_OVERHEAD=66

fail() {
  echo "::error title=Preview sign-in::$1"
  exit 1
}

valid_preview_number "$NUMBER" || fail "not a pull request number"
[[ "$PUBLIC_KEY_B64" =~ ^[A-Za-z0-9+/]+=*$ ]] && [ "${#PUBLIC_KEY_B64}" -le 4000 ] ||
  fail "the public key must be one line of base64 (the PEM file, encoded)"

work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
key="$work/public.pem"
printf '%s' "$PUBLIC_KEY_B64" | base64 -d >"$key" 2>/dev/null || fail "the public key is not valid base64"
# A private key must never be sent here at all, and some openssl versions read the public half of one with
# `-pubin`: so the file must be a PEM public key and nothing else, checked before openssl reads it.
[ "$(head -n 1 "$key")" = "-----BEGIN PUBLIC KEY-----" ] && ! grep -q 'PRIVATE' "$key" ||
  fail "the key must be a PEM public key (BEGIN PUBLIC KEY); never send a private key"
details=$(openssl pkey -pubin -in "$key" -noout -text 2>/dev/null) || fail "that is not a public key in PEM form"
[[ "$details" =~ ^Public-Key:\ \(([0-9]+)\ bit\) ]] && [[ "$details" == *Modulus:* ]] || fail "the public key must be an RSA key"
bits=${BASH_REMATCH[1]}
{ [ "$bits" -ge "$MIN_KEY_BITS" ] && [ "$bits" -le "$MAX_KEY_BITS" ]; } ||
  fail "the RSA key must be between $MIN_KEY_BITS and $MAX_KEY_BITS bits"

# The wrapper's own refusal text (fixed, from ops/preview-wrapper.sh) is shown by ssh's error output.
plain=$(ssh -o ConnectTimeout=30 -o ConnectionAttempts=1 vps "credentials $NUMBER") ||
  fail "the server did not hand out the sign-in (the line above says why)"
[ -n "$plain" ] || fail "the server handed out nothing"

# Masked first, before anything else runs: each line, and the password after its `=`.
while IFS= read -r line; do
  [ -n "$line" ] || continue
  echo "::add-mask::$line"
  echo "::add-mask::${line#*=}"
done <<<"$plain"

# (the command substitution dropped the last newline; it is put back so the file opens as it was)
[ "$((${#plain} + 1))" -le $((bits / 8 - OAEP_OVERHEAD)) ] || fail "the sign-in is too long for this key; use a 4096-bit RSA key"
sealed=$(printf '%s\n' "$plain" | openssl pkeyutl -encrypt -pubin -inkey "$key" \
  -pkeyopt rsa_padding_mode:oaep -pkeyopt rsa_oaep_md:sha256 -pkeyopt rsa_mgf1_md:sha256 2>/dev/null |
  base64 -w0) || fail "the sign-in could not be sealed"
[ -n "$sealed" ] || fail "the sign-in could not be sealed"
unset plain

echo "::notice title=Preview sign-in::sealed for preview $NUMBER; only the holder of the private key can open it"
echo "sealed-sign-in-begin"
echo "$sealed"
echo "sealed-sign-in-end"
