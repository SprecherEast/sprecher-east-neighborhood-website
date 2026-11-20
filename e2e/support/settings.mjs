// Shared by the server launcher (serve.mjs), the Playwright config and the tests (#311).
export const E2E = {
  port: 3998,
  baseURL: 'http://localhost:3998',
  smtpPort: 2526,
  // Under e2e/, gitignored: the database and the caught emails, wiped at every start
  dataDir: 'e2e/.data',
  // The contact form's owner notification goes here (seed.ts)
  ownerEmail: 'owner@example.com',
  // The second server, for the passkey flows (#1317): `next dev` with the passkey switch on,
  // because the production build on http://localhost can't have it on (decision 0021's
  // relying-party rule refuses localhost in production). Its own port, database and mailbox, so
  // both servers run at once without sharing anything
  passkeys: {
    port: 3997,
    baseURL: 'http://localhost:3997',
    smtpPort: 2527,
    dataDir: 'e2e/.data-passkeys',
  },
}
