# shellcheck shell=bash
# shellcheck disable=SC2154 # $base and $work are set by install-umami.sh before these run
# Umami's admin password (#948), sourced by install-umami.sh. Needs $work (a private folder),
# $base (Umami on 127.0.0.1), fail_closed (umami-caddy.sh), and sets `code` and `token`.
# Requests are described in a curl config file and the bodies in files in $work, so no password
# or token appears in a command line or the log. Endpoints: docs.umami.is/docs/api.

ADMIN_USER='admin'
DEFAULT_PASSWORD='umami' # Umami's documented first login: admin / umami (docs.umami.is/docs/install)

# Sets `code` (HTTP status, 000 if none) and leaves the answer in $work/answer.
api() { # <method> <path> [body file] [token]
  {
    echo 'silent'
    echo 'max-time = 20'
    echo "url = \"$base$2\""
    echo "request = \"$1\""
    echo 'header = "Content-Type: application/json"'
    echo "output = \"$work/answer\""
    echo 'write-out = "%{http_code}"'
    [ -z "${3:-}" ] || echo "data-binary = \"@$3\""
    [ -z "${4:-}" ] || echo "header = \"Authorization: Bearer $4\""
  } >"$work/request.cfg"
  : >"$work/answer"
  code=$(curl -K "$work/request.cfg" 2>/dev/null || true)
  code="${code:-000}"
}

json_body() { # <file> <field=VARIABLE_NAME…>: a JSON object whose values come from environment variables
  node -e '
    const body = {}
    for (const pair of process.argv.slice(1)) { const [k, v] = pair.split("="); body[k] = process.env[v] ?? "" }
    process.stdout.write(JSON.stringify(body))' "${@:2}" >"$1"
}

answer_field() { # <name>: a top-level field of the last answer, as text
  node -e 'try { const v = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"))[process.argv[2]]; process.stdout.write(v == null ? "" : String(v)) } catch {}' "$work/answer" "$1"
}

# Sets `code`, and `token` when the login gave one. With two-factor sign-in on, Umami answers 200
# with `requiresTwoFactor` and no token: the password was right, so that is a 200 without a token.
login() { # <password>
  ADMIN_USER="$ADMIN_USER" LOGIN_PASSWORD="$1" json_body "$work/login.json" username=ADMIN_USER password=LOGIN_PASSWORD
  api POST /api/auth/login "$work/login.json"
  token=""
  [ "$code" != 200 ] || token=$(answer_field token)
  [ "$code" != 200 ] || [ -n "$token" ] || [ "$(answer_field requiresTwoFactor)" = true ] || code=000 # a 200 that is no login
}

unexpected() { fail_closed "Umami's $1 answered $code, not what its API documents"; }

# Leaves the admin password as the secret's, or as someone set it by hand; never the default.
# Ends the run (fail_closed) when it can't tell or can't change it.
secure_admin_password() { # <the secret's password>
  local new="$1"
  login "$new"
  case "$code" in
    200) report "Umami's admin password is already the one in the secret" ;;
    401)
      login "$DEFAULT_PASSWORD"
      case "$code" in
        200)
          [ -n "$token" ] || unexpected "login with the default password (no token)"
          ADMIN_CURRENT="$DEFAULT_PASSWORD" ADMIN_NEW="$new" json_body "$work/change.json" currentPassword=ADMIN_CURRENT newPassword=ADMIN_NEW
          api POST /api/me/password "$work/change.json" "$token"
          [ "$code" = 200 ] || unexpected "change of the default admin password"
          login "$new"
          [ "$code" = 200 ] || unexpected "login with the new admin password"
          report "Umami's default admin password was replaced with the one in the secret"
          ;;
        401) report "Umami's admin password is neither the default nor the one in the secret (changed in Umami); left as it is" ;;
        *) unexpected "login" ;;
      esac
      ;;
    *) unexpected "login" ;;
  esac
  login "$DEFAULT_PASSWORD"
  [ "$code" = 401 ] || fail_closed "Umami still accepts its default admin password (login answered $code)"
  report "Umami rejects its default admin password"
}
