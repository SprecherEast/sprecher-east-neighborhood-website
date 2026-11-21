# Signing in to a preview

A pull request preview has a test account for each role (admin, editor, resident, guest). Their passwords are
random, change on every deploy and live only on the server. **An AI agent signs in through the browser for the
owner, so a password does not have to travel;** it hands one over privately only if he asks. It never pastes a
password into a chat, an issue, a pull request, a comment or a log: this repository is public.

To get one, make a new RSA key pair in your own sandbox for this request (4096 bits advised, 3072 at least). Make
the public key one line of base64 (`base64 -w0 public.pem`), then dispatch the `Preview sign-in` workflow
(`.github/workflows/preview-sign-in.yml`, which needs write access) with the pull request's number and that line.
Read the run's log through the REST API (each line starts with a timestamp, which you cut off), take the line
between `sealed-sign-in-begin` and `sealed-sign-in-end`, open it with your private key
(`base64 -d | openssl pkeyutl -decrypt -inkey private.pem -pkeyopt rsa_padding_mode:oaep -pkeyopt rsa_oaep_md:sha256
-pkeyopt rsa_mgf1_md:sha256`), sign in, and delete the key and the plaintext. Send only the public half: a key
pair whose private half was sent anywhere is public, so throw it away and make another. A refusal says the
preview does not exist or has no sign-in to hand out (the last deploy did not finish its accounts): redeploy it.
How it works and its limits: [`ops/previews.md`](../../ops/previews.md#the-workflow-1075).
