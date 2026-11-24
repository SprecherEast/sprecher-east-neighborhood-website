# Note template

How to write a knowledge note. The structure (fields, fixed sections for each note type, the node
and relationship vocabulary, the limits) is defined once, in
[`note-schema.json`](note-schema.json); nothing here restates it. `npm run knowledge:structure`
checks every note against it, and prints a starting point for a new one:

```bash
npm run knowledge:structure -- --skeleton <type>   # a type from noteTypes in the schema
```

Put the note next to the code it describes (`src/modules/<name>/README.md`, a shared area of
`src/platform/`, or a feature's own folder), add its entry to [`map.json`](map.json), then run
`npm run knowledge:structure -- --write-index` to make its line in the [index](index.md). Why it
looks like this: decision [0022](../architecture/decisions/0022-knowledge-note-structure.md).

## What to write

- Write only what the code doesn't show quickly. Field lists, props, routes, endpoints, tools and
  schedules are in the generated reference (`docs/reference/`): link it, never copy it.
- Front matter holds the facts a program reads. `relationships` lists only what code and the
  reference cannot show; the scanner derives the rest from imports, links and the map.
- Every claim names the file or test it comes from, so a reader can check it and a reviewer can see
  when it goes stale. A path that doesn't exist fails the check.
- Each section's hint is in the schema and in the skeleton. A section the schema marks `expected`
  and a note lacks is a warning, not a failure, until #1004 has written the missing ones.
- Known gaps are the node's watch-outs on the map: write what a reader should know before changing
  the part, or "None".
- At most the number of lines the schema sets, counted below the front matter. A part too big for
  one note gets a feature note next to its code and its own map entry; `exclude` in the map takes
  its files out of the parent's entry so each file has one note.
