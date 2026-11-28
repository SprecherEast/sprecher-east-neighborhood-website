# What the model stages are given

Part of the [intelligence README](README.md#how-a-runtime-loads-it). Every model stage gets its
prompt, `coverage.md` (with the area's words and the safety definition), its output schema and the
item. Verify and curate also get the neighborhood background (#1434); draft does not
(`background.stages` in `pipeline.yaml`).

- **The summary, always.** [`background/summary.md`](background/summary.md): a few lines on what the
  City planned, how old that is, and that a plan is not what exists.
- **A topic note, only when the item calls for it.** Verify is shown the list of notes
  (`background.topics`: an id and what it covers) and names, by what the item means, the ones it
  turns on most in `$.backgroundTopics` (at most one: the summary, the list and one note fit the
  budget, two never do). Curate, and verify's high-effort rerun, are given that note. No code
  looks for words in an item.
- **One budget.** `background.maxTokens` caps what the background adds to one stage's message,
  summary included, at four characters to a token. A named note that doesn't fit is left out, and
  a summary that alone is over the budget stops the start.
- **The run log says what went in.** One note in its `errors` list (the run log has no field of its
  own yet, #1521), written after the status so it doesn't make the run `partial`, as the
  low-events note is. It is kept out of the console's "Errors" and has a place the 50-entry cap
  can't take (`lib/errorLog.mjs`). It gives the summary's size, the stages it went to, the topic
  note given, and any left out and why.
- **The checks.** `node scripts/check-intelligence.mjs` reads the files `pipeline.yaml` names, holds
  them to the budget, and holds the eval cases that name a background to it: their topics exist, and
  each `-without-background` case has a `-with-background` partner with the same input and a
  different result, so the pair shows what the context changes. The `-without-background` case
  records the wrong result a stage reaches without the context, and carries the tag `baseline`: it
  documents the gap and is not graded as the pipeline's pass or fail (the collector, #272, must
  skip `baseline` cases when it scores).

[`background.md`](background.md) and the notes under `background/` are written for people and for
an agent that reads the folder; the runner reads only the files `pipeline.yaml` names.
