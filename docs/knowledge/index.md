# Knowledge index

How the site is put together, one line per entry. Read the line, then open the note or reference
it points to. Notes load by themselves when the work touches their files; the reference is
generated. Why: decision [0019](../architecture/decisions/0019-knowledge-layer.md).

## Notes

- [Events](../../src/modules/events/README.md): the calendar, its listings, category pages and "this week" block; what "upcoming" means, what a save refreshes, official meetings, cancelled events, suggestions held as drafts.

## Reference (generated)

- [Content types](../reference/content-types/README.md): every collection and global, plugins included: fields, access per operation, hooks, drafts. `npm run docs:generate` writes it; CI (`Knowledge sync`) checks it.
- Screens and shared components: not yet (#718).
