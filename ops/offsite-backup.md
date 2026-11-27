# Off-site backup

A copy of the site's data outside the server and outside Hostinger, that the owner controls (#1332).
Hostinger's own backups sit in the same account, and the daily archives sit on the same server. The
owner's decisions are on the issue: rclone on the server for the upload only, no upload code of our own,
scheduling by the server's own cron, every archive encrypted to a public key before it leaves, the
private key only in his password manager, and the narrow `drive.file` Drive scope (the job sees only
the files it makes itself). That scope is set when the owner signs in to Google, not by the credential
file: see [the credential](#what-the-deploy-does). Part of [the server operations notes](README.md).

| Script                      | Where            | What it does                                                                                                                                       |
| --------------------------- | ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `offsite-backup.sh`         | VPS              | `run` (weekly), `test` (a small made-up file), `check` (read-only)                                                                                 |
| `install-offsite-backup.sh` | VPS              | Production deploy only: the credential, the pinned rclone, the weekly job, the first try, the check. Never fails the deploy                        |
| `offsite-lib.sh`            | both             | The shared settings (remote folder, copies kept, age limit, rclone version and checksums), the sealing and opening, the credential check           |
| `public-key-lib.sh`         | both             | The one rule for a public key to seal to: PEM, RSA, 3072 to 8192 bits, never a private key (also used by `.github/scripts/preview-credentials.sh`) |
| `offsite-restore.sh`        | owner's computer | Opens a copy with the private key, and refuses an archive that holds anything but what a backup holds                                              |

The file locations are defined once, in `environment.sh` (`OFFSITE_DIR` and the rest).

## What happens, weekly

Sunday 09:30 UTC (`/etc/cron.d/sprecher-east-offsite-backup`), `offsite-backup.sh run`:

1. Takes the newest daily archive (`payload.db` made by `VACUUM INTO`, `env.local`, `media/`). It refuses one
   older than 36 hours.
2. Seals it, uploads `sprecher-east-<time>.tar.gz.cms` to the Drive folder `sprecher-east-backups`, and checks that
   Drive's size and MD5 equal the sealed file's. A copy that does not match is deleted and the run fails.
3. Only then keeps the newest 8 copies. Older ones are deleted for good, not trashed, so the quota is freed. Only
   names this job makes can ever be deleted (the pattern is anchored at both ends). A listing of Drive that fails
   here fails the run (the new copy stays; nothing is pruned), so it is seen.
4. Records the sealed copy's **SHA-256** (below). `flock` stops two runs overlapping, the work folder is removed when it ends, a run needs the disk to have room for
   the sealed copy plus 1 GB, and any failure exits non-zero with a message. rclone's own messages go to the root-only
   log `/var/log/sprecher-east-offsite-backup.log`, never to the deploy's public output.

Only a weekly `run` writes `/var/backups/sprecher-east/offsite-status`; a `test` never clears a failed run. The job
clears every `RCLONE_*` environment variable first, so the remote is the credential file's and nothing else's.

**Each copy's SHA-256** is where the owner can read it: in the run's notice, in `offsite-status` (`file=` and
`sha256=`), in `offsite-sha256` beside it (one `sha256sum` line for each of the 8 copies kept), and in every deploy's
check annotation (the newest copy's). Compare it with the downloaded file before a restore
([below](#restore-from-an-off-site-copy)). The hash of an encrypted file tells an attacker nothing.

## How it is sealed

`openssl cms -encrypt -aes-256-gcm` to the certificate `ops/offsite-backup-cert.pem`, with RSA-OAEP (SHA-256, MGF1
SHA-256) for the per-archive key: a random data key per archive, the archive encrypted with an authenticated cipher
(a changed byte makes opening fail), the key sealed to the owner's public key, the way the repo already seals preview
sign-ins. `openssl cms` writes one standard file (RFC 5083). **Sealing streams** (a 400 MB file used 7 MB of memory).
**Opening does not**: OpenSSL reads the whole file and needs about three times its size in free memory (measured
2026-11-26: 608 MB for a 200 MB copy, by DER and by SMIME input alike, with no option that streams it; a reviewer
measured 1.2 GB for 400 MB). The job warns above 1 GiB. See [the limit](#how-big-a-copy-can-be-opened).

The file in the repository is a self-signed certificate: a public key and a fixed name, nothing else. The job refuses
anything that holds a private key, a non-RSA key, or fewer than 3072 bits. The server never holds the private key and
cannot open its own backups. It is committed like `preview-deploy-key.pub` (public by design).

- **What the sealing proves, and what it does not.** AES-GCM's tag means opening fails if one byte changed after the
  copy was sealed. It does **not** say who sealed it: the certificate is public, so anyone who can write to the Drive
  folder (the server's credential, or the Sprecher East Google account) can make a copy that opens and passes. So a
  restore compares the SHA-256 the job recorded, and the restore script refuses any archive member that a backup does not hold.
- **An expired certificate is accepted.** OpenSSL does not check the dates when it seals and only the key matters.
- **Changing the key:** make a new pair, replace `ops/offsite-backup-cert.pem`, deploy. New copies are sealed to the new
  key. **Copies already in Drive stay sealed to the old key**, so keep the old private key until the 8 old copies have
  aged out (8 weeks), or a restore from one of them is impossible.

## What the deploy does

`install-offsite-backup.sh` runs in its own deploy step after the release is live. The credential arrives on stdin
from the `production` environment secret `OFFSITE_BACKUP_RCLONE_CONF`, never in an argument or a log. The step has a
15-minute limit of its own. Each part is cut off as a whole so the step cannot outlast it: the package download 3
minutes, the first try 5 minutes, the check 2 minutes, and each rclone call in them 1 minute (a test adds the
numbers up against the step's limit).

- It checks the public key (a link in its place is reported as a link), then the credential: exactly one `[offsite]`
  section, `type = drive`, `scope = drive.file`, `client_id`, `client_secret` and `token`, each once, and nothing else (an empty `team_drive`, `root_folder_id` or
  `service_account_file` is accepted, a value is refused). A setting given twice, another spelling, a second section
  or a setting before the section is refused, because rclone keeps the last value and `type = local` would keep the
  "backup" on the server's own disk. The file stored is written from the checked values, not the text received.
  The `token` must be one line of JSON with a non-empty `access_token` and `refresh_token` and an `expiry` that is
  a real RFC 3339 date in the years 2000 to 2100 (fractional seconds are fine; 31 February, hour 24 and Go's zero time
  are refused): that is what rclone 1.76.0 needs to keep refreshing it. Google's raw sign-in response (it has
  `expires_in`, no `expiry`) is refused, and so is a name given twice in different capitals (Go's JSON reader matches
  names without regard to case and keeps the last). The token stored is written from the checked fields only
  (`access_token`, `token_type`, `refresh_token`, `expiry`). A value never appears in a message.
- **The `scope = drive.file` line proves nothing.** Google fixes the scope when the owner signs in, and a sign-in with
  full Drive access written as `scope = drive.file` would pass the file check. So the first try (`test`) asks Google's
  token-info endpoint what the access token was granted, after the upload (so an expired token has been refreshed), and
  accepts only exactly `https://www.googleapis.com/auth/drive.file`. Any other scope, or an answer with no scope, is a
  refusal and the credential is thrown away (below). No answer, or one that cannot be read, fails the try without
  throwing anything away. Every warning names no value. This is a POST with the token in the body to Google's
  `tokeninfo` endpoint, which Google documents for diagnostics with GET; the first real deploy (#1549) is what proves
  the POST form, and a failure there is fail-closed and tried again at the next deploy.
- **A new credential is tried from a staging file and promoted only when it passes.** It is written to a root-only
  staging file in `/etc/sprecher-east/` (mode 600 in a mode 700 folder, tightened if the folder already existed),
  tried there, and renamed over `/etc/sprecher-east/offsite-rclone.conf` only when the try passes. When Google says its
  scope is wrong, the staging file is deleted: on a first install nothing is stored and no job is installed, and when
  it replaces a working credential the stored credential and the weekly job stay as they were. Any other failure
  (Drive down, a timeout) also keeps the stored credential and job and deletes the staging file; the secret brings
  the credential again and it is tried at the next deploy (a Drive outage must not stop the backups), with a warning
  each time. The staging file is removed even when the run is killed.
- It installs rclone **1.76.0** from rclone's `.deb` after its SHA-256 matches the one in `offsite-lib.sh` (`dpkg -i`;
  an installed 1.76.0 is left alone), makes the log root-only, tries the credential **once per credential and key**
  with a small made-up file, and **only after that passes** installs the weekly job (`umask 077` in its line). A
  credential that fails its first try is never scheduled on a first install. `curl` runs with `-q`, so no `.curlrc`
  changes it.
- Until the key and the credential both exist it installs nothing, uploads nothing and says which is missing.
  The job itself exits 78 ("not set up") the same way and never uploads without the key.
- **Undo without a shell:** an empty secret removes the stored credential and the weekly job at the next deploy;
  removing `ops/offsite-backup-cert.pem` removes the job.
- The deploy runs as root. A future named, non-root deploy account would need sudo for this step (#1306).

## The signal the owner sees

Every deploy runs `offsite-backup.sh check` and shows the state as **warning annotations** on its run, and the deploy
**stays green**: the age of the newest copy, how the last weekly run went, and any problem with the credential or
the first try. A failed or stale backup never stalls a merge.

**Open: a louder alert.** The owner decided (2026-11-27, recorded on #1332) that a failed or stale backup must raise a
loud alert to him, not only a log line or a warning on a deploy. The repository has no owner alert for server jobs
today: its only signals are the annotations above and GitHub's own failed-run emails. The smallest way to get one is
a scheduled GitHub Actions workflow that runs the read-only `check` over the deploy's SSH access and fails when it
fails, so GitHub emails the owner. It would need to name the `production` environment, which
`.github/scripts/deploy-secrets-environment.test.mjs` forbids on purpose, so it is a policy change proposed on #1332
and waits for his answer. Until then the signal is the annotations.

## Changes to the server and how to undo them

| Change                | Where                                                                                                                    | Undo                                                                                                  |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| rclone 1.76.0 package | `/usr/bin/rclone`                                                                                                        | `apt remove rclone`                                                                                   |
| Drive credential      | `/etc/sprecher-east/offsite-rclone.conf`                                                                                 | Empty the secret and deploy; or `rm` it; remove the app at <https://myaccount.google.com/permissions> |
| Weekly job            | `/etc/cron.d/sprecher-east-offsite-backup`                                                                               | Empty the secret or remove the certificate and deploy; or `rm` it                                     |
| State and log         | `/etc/sprecher-east/offsite-tried`, `offsite-status`, `offsite-sha256` and `.offsite.lock` in the backup folder, the log | `rm` them                                                                                             |
| Copies                | Google Drive folder `sprecher-east-backups`                                                                              | Delete the folder in Drive                                                                            |

`/etc/sprecher-east/` (mode 700, made by the installer) and the log (mode 600, made by the installer) are in the
preview isolation check (`preview-isolation-check.sh`), so a preview account that could read the credential fails its deploy.

## Setting it up (the owner's steps)

The exact pages and clicks are in the owner's list on #1332. What exists, made in the owner's browser:

- **The key pair**: generated in the browser (WebCrypto, RSA 4096). The public certificate is committed as
  `ops/offsite-backup-cert.pem`; the private key is an **unencrypted PKCS#8** key (`-----BEGIN PRIVATE KEY-----`),
  held only in his password manager. It has no passphrase, so whoever holds the file can open every copy.
- **The Drive credential**: a Google Cloud project with the Drive API on, an app that is published (a "Testing" app's
  sign-in expires after 7 days), an OAuth client of type "TVs and Limited Input devices", and a sign-in with Google's
  **device flow** for the scope `drive.file` only. It is written as the `[offsite]` section the check above accepts
  (`type = drive`, `client_id`, `client_secret`, `scope = drive.file`, `token` as one line of JSON with an `expiry`)
  and saved as the `production` environment secret `OFFSITE_BACKUP_RCLONE_CONF`.
- **The fallback** if the server's rclone refuses a device-flow token: on any computer run `rclone config` (new remote
  named `offsite`, storage `drive`, scope `drive.file`, a browser sign-in), copy the block `rclone config show offsite`
  prints, and save it as the same secret. Delete the remote from that computer afterwards.
- **Another key pair** (a different way to make the key): `openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:4096
-aes-256-cbc -out private.pem`, then `openssl req -new -x509 -key private.pem -subj "/CN=Sprecher East backups"
-days 7300 -out public.pem` (on Windows in Git Bash write `//CN=`). That private key has a passphrase, which
  `offsite-restore.sh` then asks for. Commit only the public certificate.

## Restore from an off-site copy

**First: you need OpenSSL 3.0 or later on the computer that opens the copy.** The `openssl` that macOS ships is LibreSSL
and cannot. On a Mac: `brew install openssl@3`, then name it:
`OFFSITE_OPENSSL="$(brew --prefix openssl@3)/bin/openssl" bash offsite-restore.sh ...`. The script checks and says so.
Linux: any current distribution; Windows: Git Bash's OpenSSL 3 or WSL. (Tested on Linux with OpenSSL 3.0.13 only.)

The script runs on the `bash` macOS ships (3.2): it uses no bash 4 feature, and a test runs it with `mapfile` and
`readarray` switched off and bash's 3.2 compatibility mode on.

The private key never goes to the server, Drive, the repository or a chat. His key is a plain, unencrypted
PKCS#8 file kept in the password manager, so it goes into a file **only for the restore**, and that file alone opens every
copy:

- Make the file empty with mode 600 first (`install -m 600 /dev/null ~/restore-key.pem`), then write the key straight
  from the clipboard (`pbpaste > ~/restore-key.pem` on a Mac), in a folder that is **not synced** (not Google Drive for
  desktop's folder, not iCloud, Dropbox or a backup folder). Do not paste it into an editor: editors leave autosave and
  recovery copies.
- Delete it right after the restore (`shred -u ~/restore-key.pem` where `shred` exists, otherwise `rm`; `rm -P` does
  nothing on current macOS). On a modern disk deleting does not overwrite the bytes, which is why the key never
  goes into a synced or backed-up place.

1. **Get a copy.** Download `sprecher-east-<time>.tar.gz.cms` from the Drive folder `sprecher-east-backups` into a new,
   empty folder. (If Google Drive for desktop syncs that folder it is already on the computer.)
2. **Compare its SHA-256 first.** Take the hash the job recorded for that copy (the newest one is in the last deploy's
   check annotation; all 8 are in `/var/backups/sprecher-east/offsite-sha256` on the server; the status file names the
   last run's) and give it to the script. It refuses a file with another hash before opening it. This is what shows the copy
   is the one the job sent: the sealing alone cannot (see [what the sealing proves](#how-it-is-sealed)).
3. **Open it** with the repository's `ops` folder next to the script (`offsite-lib.sh` and `public-key-lib.sh` are read
   too; needs bash and OpenSSL 3):

   ```bash
   OFFSITE_EXPECTED_SHA256=<the recorded hash> bash ops/offsite-restore.sh sprecher-east-<time>.tar.gz.cms ~/restore-key.pem ./opened
   ```

   It refuses a wrong key or a copy that was changed or damaged (nothing is written then; a key with a passphrase is asked
   for it), accepts only a file named like the job's own copies (`sprecher-east-<time>.tar.gz.cms`), and then reads
   the opened archive member by member, always: only `payload.db`, `env.local` and plain files and
   folders under `media/` pass. A link, a device, a setuid bit, an absolute or parent path, a backslash in a name or any
   other name is refused, and nothing is written. It prints "Checked" only after that check passed, and says whether the SHA-256 was compared. It writes
   `sprecher-east-<time>.tar.gz` readable by you only. It holds
   residents' emails and the site's secrets; delete it afterwards.

4. **Put it on the server** with `scp` into `/root/`, then follow
   [Restore content from an archive](README.md#restore-content-from-an-archive) with that file in place of
   `/var/backups/sprecher-east/daily/<archive>.tar.gz` (extract with `--no-same-owner --no-same-permissions`, as the
   steps there say), and `rm` the uploaded archive when done.
5. **The first real restore drill** (#1549) is done once after the first real copy is in Drive, and written on that
   issue: which copy, how long it took, what was checked.

### How big a copy can be opened

Free memory needed to open a copy is about **three times its size**. A 1 GB copy needs about 3 GB free. The owner
decided (2026-11-27, recorded on #1332) not to split archives into chunks (a new file format): the job warns above 1 GiB
and names the size, so that warning is the watch on the size. If a copy ever grows past what the
owner's computer can hold, he can open it on a larger machine. No stock OpenSSL option streams the opening (measured
2026-11-26).

The tests (`offsite-backup.test.mjs`) run the whole round trip with a throwaway key pair and a local stand-in for
rclone, including a wrong key, a one-byte change, an old OpenSSL, and what the job refuses.
