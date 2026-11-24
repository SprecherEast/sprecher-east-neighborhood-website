# 0022: Knowledge notes have front matter and fixed sections, defined once and checked

- **Date:** 2026-11-24
- **Status:** Accepted
- **Issue:** #1460, first piece of the system map (#1446)
- **Supersedes:** the note and index parts of [0019](0019-knowledge-layer.md) (§2 point 1, §3); the rest of 0019 stands

## Context

The notes next to the code each had a different shape and nothing a program could read, so a map
could not draw them and nothing checked them: of 14 notes, 1 matched the template and 2 were over
its cap. Owner direction this rests on (recorded on #1446 and #1460):

- 2026-11-24, voice session: every note carries consistent, structured information a scanner can
  extract (what the thing is, its type, what it relates to and how, what it depends on); the
  structure is defined once; relationships are typed.
- 2026-11-24, text session (choice A1): the structured facts sit in a small block of fields at the
  top of each note; the index line is made from its summary; only relationships the code cannot
  show are written by hand.
- 2026-11-24, chief of staff (choice B1, routine technical choice): the always-loaded index stays
  short; clusters go in a generated catalog read on demand (built by the scanner, #1462).
- 2026-11-23, voice session, recorded on #1004: the layer follows Karpathy's LLM wiki method.

## Decision

1. **One definition.** [`docs/knowledge/note-schema.json`](../../knowledge/note-schema.json) holds
   the front matter fields, the fixed sections for each note type (with whether each is required,
   expected or optional), the node and relationship vocabulary, the limits and the state of each
   rule. The template, this record and the check read or point to it; none restates it.
2. **Front matter, then sections.** A note starts with `name`, `type`, `summary`, `aliases` and
   `relationships`, read with `scripts/frontmatter.mjs`. Notes load only on demand through their
   path-scoped rules, so the front matter adds nothing to session start.
3. **The index is generated.** The lines under "Notes" in `docs/knowledge/index.md` are made from
   each note's `name` and `summary`, in map order; the check fails when they differ. The
   index stays within its token share.
4. **The cap** counts the lines below the front matter, so metadata does not use up the room for
   explanation. A part over the cap is split into a feature note with its own map entry; a map
   entry may `exclude` paths, so a split note's files belong to one note.
5. **The check** (`scripts/knowledge-structure/`, a step of the `Knowledge sync` job, required
   without a ruleset change) fails on: front matter or fields missing, unknown or out of order; a
   type or relationship type outside the vocabulary or a derived one written by hand; a
   relationship target or a backticked path that does not exist; a missing title, purpose or
   required section; a heading outside the set; a note over the cap; an orphan README, a map entry
   without a note or matching no code, a note naming no code; an index line that differs.
6. **Rule states.** A rule is `block` or `warn` in the schema. Structure rules block, because
   every note passes them. The path rule stays `warn`: one abbreviated test name in a note is
   passed to #1004 with the content corrections. The coverage rules (an expected section not yet
   written; source code no note describes) stay `warn`, with their count in the job summary; #1004
   turns them to `block` when no part is left without a note.
7. **Hand-written relationships** are limited to the types the vocabulary marks `hand`
   (`depends-on` and similar); the scanner derives the others from the code, the generated
   reference, the map and Markdown links.

## Consequences

- Easier: a map or an agent reads a note's type, summary and relationships exactly; a note that
  drifts from the structure fails in the pull request.
- Harder: a new note needs its front matter and a map entry, and its index line is regenerated.
- Open: content accuracy and missing notes are #1004; the scanner is #1462.

## Links

#1446, #1460, #1004, #1462, [0019](0019-knowledge-layer.md).
