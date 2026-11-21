import { addPasskey, getPasskeyOptions } from '../actions'
import { createPasskey } from './passkeyBrowser'
import type { AddPasskeyOutcome } from './passkeyMessages'

/**
 * Asks for the options, shows the browser's own prompt, then sends its answer. Every way it can
 * end is one outcome; nothing the server or the browser says is passed on as text. A request that
 * gets no answer is `offline`. Shared by the card on /account and the offer after a log in (#1364).
 */
export async function addAPasskey(label: string): Promise<AddPasskeyOutcome> {
  try {
    const started = await getPasskeyOptions()
    if (!started.ok) return started.failure
    const made = await createPasskey(started.options)
    if (!made.ok) return made.reason
    const finished = await addPasskey({ answer: made.answer, label })
    return finished.ok ? 'added' : finished.failure
  } catch {
    return 'offline'
  }
}
