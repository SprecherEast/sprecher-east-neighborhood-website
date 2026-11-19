// Payload entry: the events collection and the "this week" block (#122) for payload.config.ts.
// Nothing here may be server-only, because the Payload CLI (migrations, seed) loads it outside
// Next.js.
export { Events } from './cms/events'
export { EventsThisWeekBlock } from './cms/eventsThisWeekBlock'
