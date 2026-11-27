# Off-site backup

A copy of the site's data outside the server and outside Hostinger, that the owner controls (#1332).
Hostinger's own backups sit in the same account, and the daily archives sit on the same server. The
owner's decisions are on the issue: rclone on the server for the upload only, no upload code of our own,
scheduling by the server's own cron, every archive encrypted to a public key before it leaves, the
private key only in his password manager, and the narrow `drive.file` Drive scope (the job sees only
the files it makes itself). Part of [the server operations notes](README.md).

| Script                      | Where            | What it does                                                                                                                                       |
| --------------------------- | ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `offsite-backup.sh`         | VPS              | `run` (weekly), `test` (a small made-up file), `check` (read-only)                                                                                 |
| `install-offsite-backup.sh` | VPS              | Production deploy only: the credential, the pinned rclone, the weekly job, the first try, the check. Never fails the deploy                        |
| `offsite-lib.sh`            | both             | The shared settings (remote folder, copies kept, age limit, rclone version and checksums), the sealing and opening, the credential check           |
| `public-key-lib.sh`         | both             | The one rule for a public key to seal to: PEM, RSA, 3072 to 8192 bits, never a private key (also used by `.github/scripts/preview-credentials.sh`) |
| `offsite-restore.sh`        | owner's computer | Opens a copy with the private key                                                                                                                  |

The file locations are defined once, in `environment.sh` (`OFFSITE_DIR` and the rest).

## What happens, weekly

Sunday 09:30 UTC (`/etc/cron.d/sprecher-east-offsite-backup`), `offsite-backup.sh run`:

1. Takes the newest daily archive (`payload.db` made by `VACUUM INTO`, `env.local`, `media/`). It refuses one
   older than 36 hours.
2. Seals it, uploads `sprecher-east-<time>.tar.gz.cms` to the Drive folder `sprecher-east-backups`, and checks that
   Drive's size and MD5 equal the sealed file's. A copy that does not match is deleted and the run fails.
3. Only then keeps the newest 8 copies. Older ones are deleted for good, not trashed, so the quota is freed. Only
   names this job makes can ever be deleted (the pattern is anchored at both ends).
4. `flock` stops two runs overlapping, the work folder is removed when it ends, a run needs the disk to have room for
   the sealed copy plus 1 GB, and any failure exits non-zero with a message. rclone's own messages go to the root-only
   log `/var/log/sprecher-east-offsite-backup.log`, never to the deploy's public output.

Only a weekly `run` writes `/var/backups/sprecher-east/offsite-status`; a `test` never clears a failed run.

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

- **An expired certificate is accepted.** OpenSSL does not check the dates when it seals and only the key matters.
- **Changing the key:** make a new pair, replace `ops/offsite-backup-cert.pem`, deploy. New copies are sealed to the new
  key. **Copies already in Drive stay sealed to the old key**, so keep the old private key until the 8 old copies have
  aged out (8 weeks), or a restore from one of them is impossible.

## What the deploy does

`install-offsite-backup.sh` runs in its own deploy step after the release is live. The credential arrives on stdin
from the `production` environment secret `OFFSITE_BACKUP_RCLONE_CONF`, never in an argument or a log. The step has a
15-minute limit of its own, and rclone calls in `test` and `check` are cut off after 4 minutes.

- It checks the public key, then the credential: exactly one `[offsite]` section, `type = drive`, `scope = drive.file`,
  `client_id`, `client_secret` and `token`, each once, and nothing else (an empty `team_drive`, `root_folder_id` or
  `service_account_file` is accepted, a value is refused). A setting given twice, another spelling, a second section
  or a setting before the section is refused, because rclone keeps the last value and `type = local` would keep the
  "backup" on the server's own disk. The file stored is written from the checked values, not the text received.
- It stores the file as `/etc/sprecher-east/offsite-rclone.conf` (mode 600 in a mode 700 folder, replaced in one
  rename; nothing is made before a key and a credential both exist), installs rclone **1.76.0** from rclone's `.deb`
  after its SHA-256 matches the one in `offsite-lib.sh` (`dpkg -i`; an installed 1.76.0 is left alone), installs the
  weekly job, and tries the credential **once per credential and key** with a small made-up file.
- Until the key and the credential both exist it installs nothing, uploads nothing and says which is missing.
  The job itself exits 78 ("not set up") the same way and never uploads without the key.
- **Undo without a shell:** an empty secret removes the stored credential and the weekly job at the next deploy;
  removing `ops/offsite-backup-cert.pem` removes the job.
- The deploy runs as root. A future named, non-root deploy account would need sudo for this step (#1306).

## The signal the owner sees

Every deploy runs `offsite-backup.sh check` and shows the state as **warning annotations** on its run, and the deploy
**stays green**: the age of the newest copy, how the last weekly run went, and any problem with the credential or
the first try. A failed or stale backup never stalls a merge. The owner has been asked whether he wants a stronger
signal (a red deploy, or an issue opened automatically): the options are on #1332. A scheduled check that does not
wait for a deploy would need a workflow to name the `production` environment, which
`.github/scripts/deploy-secrets-environment.test.mjs` forbids on purpose.

## Changes to the server and how to undo them

| Change                | Where                                                                                                  | Undo                                                                                                  |
| --------------------- | ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| rclone 1.76.0 package | `/usr/bin/rclone`                                                                                      | `apt remove rclone`                                                                                   |
| Drive credential      | `/etc/sprecher-east/offsite-rclone.conf`                                                               | Empty the secret and deploy; or `rm` it; remove the app at <https://myaccount.google.com/permissions> |
| Weekly job            | `/etc/cron.d/sprecher-east-offsite-backup`                                                             | Empty the secret or remove the certificate and deploy; or `rm` it                                     |
| State and log         | `/etc/sprecher-east/offsite-tried`, `offsite-status` and `.offsite.lock` in the backup folder, the log | `rm` them                                                                                             |
| Copies                | Google Drive folder `sprecher-east-backups`                                                            | Delete the folder in Drive                                                                            |

`/etc/sprecher-east/` and the log are in the preview isolation check (`preview-isolation-check.sh`), so a preview
account that could read the credential fails its deploy.

## Setting it up (the owner's steps)

Make the key pair on your own computer, give back only the public certificate (an agent commits it), then create the
Drive credential and set the secret. The exact pages and clicks are in the owner's list on #1332.

```bash
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:4096 -aes-256-cbc -out sprecher-east-backup-private.pem
openssl req -new -x509 -key sprecher-east-backup-private.pem -subj "/CN=Sprecher East backups" -days 7300 -out sprecher-east-backup-public.pem
```

The first command asks for a passphrase. Keep the private file and the passphrase in the password manager; without them
no copy can be opened. Give back only `sprecher-east-backup-public.pem`. On Windows in Git Bash write
`-subj "//CN=Sprecher East backups"` (Git Bash would turn `/CN=` into a path).

## Restore from an off-site copy

**First: you need OpenSSL 3.0 or later on the computer that opens the copy.** The `openssl` that macOS ships is LibreSSL
and cannot. On a Mac: `brew install openssl@3`, then name it:
`OFFSITE_OPENSSL="$(brew --prefix openssl@3)/bin/openssl" bash offsite-restore.sh ...`. The script checks and says so.
Linux: any current distribution; Windows: Git Bash's OpenSSL 3 or WSL. (Tested on Linux with OpenSSL 3.0.13 only.)

The private key never goes to the server, Drive, the repository or a chat.

1. **Get a copy.** Download `sprecher-east-<time>.tar.gz.cms` from the Drive folder `sprecher-east-backups` into a new,
   empty folder. (If Google Drive for desktop syncs that folder it is already on the computer.)
2. **Open it** with the repository's `ops` folder next to the script (`offsite-lib.sh` and `public-key-lib.sh` are read
   too; needs bash and OpenSSL 3):

   ```bash
   bash ops/offsite-restore.sh sprecher-east-<time>.tar.gz.cms /path/to/sprecher-east-backup-private.pem ./opened
   ```

   It asks for the key's passphrase, refuses a wrong key or a copy that was changed or damaged (nothing is written
   then), checks the result is a readable archive, and writes `sprecher-east-<time>.tar.gz` readable by you only: the same
   archive `backup.sh` makes. It holds residents' emails and the site's secrets; delete it afterwards.

3. **Put it on the server** with `scp` into `/root/`, then follow
   [Restore content from an archive](README.md#restore-content-from-an-archive) with that file in place of
   `/var/backups/sprecher-east/daily/<archive>.tar.gz`, and `rm` the uploaded archive when done.
4. **The first real restore drill** (#1549) is done once after the first real copy is in Drive, and written on that
   issue: which copy, how long it took, what was checked.

### How big a copy can be opened

Free memory needed to open a copy is about **three times its size**. A 1 GB copy needs about 3 GB free. If a copy
grows past what the owner's computer can hold, the options are splitting the archive into chunks sealed one by one
with a sealed list of their checksums (a new file format, and so a decision for the owner), or opening on a larger
machine. No stock OpenSSL option streams the opening (measured 2026-11-26). The job's warning names the size.

The tests (`offsite-backup.test.mjs`) run the whole round trip with a throwaway key pair and a local stand-in for
rclone, including a wrong key, a one-byte change, an old OpenSSL, and what the job refuses.
