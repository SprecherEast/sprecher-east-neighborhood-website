import { ACCOUNTS_MESSAGES } from './accounts'
import { CONTACT_MESSAGES } from './contact'

/** Every message the site shows, by key. Add a file per area and spread it in here. */
export const MESSAGES = { ...CONTACT_MESSAGES, ...ACCOUNTS_MESSAGES } as const

export type MessageKey = keyof typeof MESSAGES
