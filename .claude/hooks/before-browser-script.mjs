#!/usr/bin/env node
// PreToolUse hook on the browser `javascript_tool` tools (#812): a script that publishes an image
// is refused until it carries the image-review line, so the review the guidelines require happens
// before a picture reaches the live site. Exit 2 blocks the call and shows Claude why.
import { readInput } from './io.mjs'
import { imagePublishCheck } from './rules.mjs'

const input = readInput()
const script = input?.tool_input?.text ?? input?.tool_input?.code ?? input?.tool_input?.script
const reason = imagePublishCheck(script)
if (reason) {
  process.stderr.write(`Blocked: ${reason}\n`)
  process.exit(2)
}
