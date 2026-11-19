import { MESSAGES, type MessageKey } from './catalog'
import { fillBlanks } from './message'

export type { MessageKey } from './catalog'

/** The sentence for a key, with its blanks filled, e.g. a link's lifetime from `formatDuration`. */
export function message(key: MessageKey, values: Readonly<Record<string, string>> = {}): string {
  return fillBlanks(MESSAGES[key], values)
}
