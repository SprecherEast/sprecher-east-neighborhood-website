/**
 * How long a database write waits for a lock before failing with `SQLITE_BUSY`, in milliseconds
 * (#153, #1147). Locks here are brief: the pre-deploy backup copy, the deploy's migration step
 * meeting a write from the running site, two overlapping writes. Short, so a lock that does not
 * clear still fails the request or the deploy instead of hanging.
 */
export const SQLITE_BUSY_TIMEOUT_MS = 5000
