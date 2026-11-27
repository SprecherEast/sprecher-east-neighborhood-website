# shellcheck shell=bash
# The one rule for a public key that is handed over to be sealed to (#1332, #1394): a PEM public key, RSA, of a sound
# size, and never a private key. Sourced by .github/scripts/preview-credentials.sh (a requester's one-time key) and by
# ops/offsite-lib.sh (the owner's backup key, after it is taken out of its certificate). Needs only bash and openssl.
# shellcheck disable=SC2034 # the scripts that source this file use what it sets

# Below this the key is not worth sealing to, and a smaller one would not hold the file anyway (OAEP with
# SHA-256 takes the key's bytes minus 66).
PUBLIC_KEY_MIN_BITS=3072
PUBLIC_KEY_MAX_BITS=8192

# Checks <file>. On success returns 0 and sets PUBLIC_KEY_BITS. Otherwise returns 1 and sets PUBLIC_KEY_PROBLEM to a
# fixed sentence: openssl's own words, which could name a path, are never kept. A private key must never be sent here
# at all, and some openssl versions read the public half of one with `-pubin`, so the file must be a PEM public key and
# nothing else, checked before openssl reads it.
public_key_problem() { # <file>
  local file="$1" details
  PUBLIC_KEY_BITS=""
  PUBLIC_KEY_PROBLEM=""
  if [ "$(head -n 1 "$file" 2>/dev/null)" != "-----BEGIN PUBLIC KEY-----" ] || grep -q 'PRIVATE' "$file"; then
    PUBLIC_KEY_PROBLEM="the key must be a PEM public key (BEGIN PUBLIC KEY); never send a private key"
    return 1
  fi
  details=$(openssl pkey -pubin -in "$file" -noout -text 2>/dev/null) || {
    PUBLIC_KEY_PROBLEM="that is not a public key in PEM form"
    return 1
  }
  if ! [[ "$details" =~ ^Public-Key:\ \(([0-9]+)\ bit\) ]] || [[ "$details" != *Modulus:* ]]; then
    PUBLIC_KEY_PROBLEM="the public key must be an RSA key"
    return 1
  fi
  PUBLIC_KEY_BITS=${BASH_REMATCH[1]}
  if [ "$PUBLIC_KEY_BITS" -lt "$PUBLIC_KEY_MIN_BITS" ] || [ "$PUBLIC_KEY_BITS" -gt "$PUBLIC_KEY_MAX_BITS" ]; then
    PUBLIC_KEY_PROBLEM="the RSA key must be between $PUBLIC_KEY_MIN_BITS and $PUBLIC_KEY_MAX_BITS bits"
    return 1
  fi
  return 0
}
