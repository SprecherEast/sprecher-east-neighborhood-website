// The run log's `errors` list (#1434). Real errors stop short of the cap, so the notes a run adds
// at the end (the background note, the low-events note) always have their place. A note is in the
// same list, since the CMS run log has no field of its own for it, but it is not an error: it
// doesn't count toward the run's status and the console line leaves it out.

/** The most entries the run log keeps, errors and notes together. */
export const MAX_ENTRIES = 50
/** Places kept free for notes: the low-events note and the background note. */
export const NOTE_ROOM = 2

const clip = (text) => String(text).slice(0, 500)

export function newErrorLog(max = MAX_ENTRIES, noteRoom = NOTE_ROOM) {
  const errors = []
  const notes = []
  return {
    errors,
    notes,
    addError: (text) => errors.length < max - noteRoom && errors.push(clip(text)),
    addNote(text) {
      notes.push(clip(text))
      errors.push(clip(text))
    },
    /** How many entries are real errors. */
    problemCount: () => errors.length - notes.length,
  }
}
