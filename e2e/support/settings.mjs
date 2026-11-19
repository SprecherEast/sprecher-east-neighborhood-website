// Shared by the server launcher (serve.mjs), the Playwright config and the tests (#311).
export const E2E = {
  port: 3998,
  baseURL: 'http://localhost:3998',
  smtpPort: 2526,
  // Under e2e/, gitignored: the database and the caught emails, wiped at every start
  dataDir: 'e2e/.data',
  // The contact form's owner notification goes here (seed.ts)
  ownerEmail: 'owner@example.com',
}
