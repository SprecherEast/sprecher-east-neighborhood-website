# 0022: Knowledge notes have front matter and fixed sections, defined once and checked

- **Date:** 2026-11-24
- **Status:** Accepted
- **Issue:** #1460, first piece of the system map (#1446)
- **Supersedes:** parts of [0019](0019-knowledge-layer.md) §2.1 and §3, listed in decisions 3 and 4 below; the rest of 0019 stands

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
   the front matter fields (each with its value kind), the fixed sections for each note type
   (each marked required, expected or optional), the node and relationship vocabulary, the limits
   and the state of each rule. The template, this record and the check read or point to it; none
   restates it. A field added to the schema is checked, and printed in a new note, without a code
   change, as long as its kind is one the check handles (text, a note type, a list of texts,
   relationships). A field of a new kind needs code in the check, which stops with an error
   naming the field until it has it.
2. **Front matter, then sections.** A note starts with its fields, read with
   `scripts/frontmatter.mjs`. Notes load only on demand, through their path-scoped rules, so the
   front matter adds nothing to session start.
3. **The index lines are generated.** The lines under "Notes" in `docs/knowledge/index.md` are made
   from each note's name and summary, in map order; the check fails when they differ. The
   [0019](0019-knowledge-layer.md) §2.1 sentence that caps the index at 25 lines is **replaced**
   by the index's share of the always-loaded token budget, which the `Agent context` check
   already enforces. The rest of §2.1 stands: one line per note and per reference section, loaded
   every session, imported by `CLAUDE.md`.
4. **What of 0019 §3 is replaced and what stands.** Replaced: "what" a note holds is the sections
   of the schema (not the template's prose), and a part too big for one note (the example of
   `site`) gets a feature note next to its code with its own map entry. Stands: where notes live,
   "what not" (no field lists, props tables or route lists, no history, nothing the reader learns
   faster from the code), and "written, not generated" (a person or an agent traces every
   sentence to a file or a test; a model may draft, nothing merges unchecked). The 80-line limit of
   §2.2 stands, counted below the front matter, so metadata does not use up the room for
   explanation.
5. **`exclude` on a map entry.** An entry may list paths another note takes out of it, so each
   file belongs to one note. The sync check, the Claude Code hook and the generated path-scoped
   rules all honour it. Claude Code's `paths` has no exclude, so a parent's generated rule lists
   the folders and files it keeps; adding a file to such a parent's folder means running
   `npm run agent-context -- --write`.
6. **The check** (`scripts/knowledge-structure/`, a step of the `Knowledge sync` job, required
   without a ruleset change) enforces the schema and the rules in its `rules` list, each with a
   state. A relationship target is an exact repository-relative path. A link, or a backticked path
   starting with `./` or `../`, is read exactly from the note's folder, and a link starting with `/`
   from the repository root; a backticked `/x` or `@/x` is a route or an alias and is not checked.
   Any other backticked path may be an abbreviation, as the notes write them (a bare name after its
   folder, the end of a long path, no extension), and counts when some path in the repository ends
   with it. So a moved file is missed while a same-named file exists elsewhere: the rule is firm
   for exact paths and links and weak for abbreviated ones.
7. **Rule states, and why some only warn.** Every structure rule blocks, because every note passes
   it. Three rules only warn, for one reason: what they report is missing or wrong content, and
   this change must not add, drop or invent a fact (it changes structure, not meaning). They are
   the path rule (one wrong test name in a note), the expected sections not yet written, and
   source code no note describes. [#1004](https://github.com/SprecherEast/sprecher-east-neighborhood-website/issues/1004)
   writes the content and turns all three to blocking; that is an acceptance criterion of #1004.
   Until then a note without a Known gaps section has no watch-outs to read, and the counts are in
   the job summary. Which sections are required is in the schema; only one is, for the same
   reason, and #1004 can raise the rest there.

## Consequences

- Easier: a map or an agent reads a note's type, summary and relationships exactly; a note that
  drifts from the structure fails in the pull request.
- Harder: a new note needs its front matter and a map entry, and its index line is regenerated.
- Open: content accuracy and missing notes are #1004; the scanner is #1462.

## Links

#1446, #1460, #1004, #1462, [0019](0019-knowledge-layer.md).
