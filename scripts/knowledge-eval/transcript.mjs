// Reads one run's `claude -p --output-format stream-json` transcript (#715). Pure: no files, no
// network.

/** Every token the session used, over all models: input, output and both cache counts. */
export function totalTokens(modelUsage) {
  let total = 0
  for (const usage of Object.values(modelUsage ?? {})) {
    total +=
      (usage.inputTokens ?? 0) +
      (usage.outputTokens ?? 0) +
      (usage.cacheReadInputTokens ?? 0) +
      (usage.cacheCreationInputTokens ?? 0)
  }
  return total
}

function parseLines(text) {
  const events = []
  for (const line of text.split('\n')) {
    try {
      events.push(JSON.parse(line))
    } catch {
      // A blank or cut-off line: skip it
    }
  }
  return events
}

/**
 * Summarise a transcript. `workdir` is the run's checkout, so file paths come out relative to it.
 * A run without a `result` event (timeout, crash) is `finished: false` with zero tokens.
 */
export function parseTranscript(text, workdir) {
  const prefix = `${workdir}/`
  const files = new Set()
  let toolCalls = 0
  let result = null
  for (const event of parseLines(text)) {
    if (event.type === 'result') result = event
    if (event.type !== 'assistant') continue
    for (const block of event.message?.content ?? []) {
      if (block.type !== 'tool_use') continue
      toolCalls += 1
      const file = block.input?.file_path
      if (block.name === 'Read' && file)
        files.add(file.startsWith(prefix) ? file.slice(prefix.length) : file)
    }
  }
  return {
    finished: result !== null,
    tokens: totalTokens(result?.modelUsage),
    toolCalls,
    filesRead: [...files].sort(),
    turns: result?.num_turns ?? 0,
    durationMs: result?.duration_ms ?? 0,
    costUsd: result?.total_cost_usd ?? 0,
    answer: result?.result ?? '',
  }
}
