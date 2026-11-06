/**
 * The environment the generator loads the config in. Fixed, so the pages never depend on the
 * machine: `NODE_ENV=production` is how the live site runs (the sign-in cookie is `Secure` only
 * there), and the secret and database URI are placeholders because nothing connects.
 */
export const GENERATOR_ENV = {
  NODE_ENV: 'production',
  PAYLOAD_SECRET: 'docs-generate-placeholder-secret-32-chars',
  DATABASE_URI: 'file::memory:',
}

/** Sets the fixed values, overriding whatever the machine has. */
export function pinEnvironment(env = process.env) {
  Object.assign(env, GENERATOR_ENV)
}
