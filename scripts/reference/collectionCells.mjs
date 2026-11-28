/**
 * How the reference pages write the collections a tool or a job task reaches (#1461): a link to
 * each content type's page with the operations found, the reasons the code gives where access is
 * bypassed, and the sentence that says which calls are counted. Shared by the tools and jobs pages.
 */
import { cell, code } from '../content-types/render.mjs'
import { COUNTED_CALLS, operationsSuffix } from './collectionCalls.mjs'

/** `[`events`](content-types/events.md) (read (access checked))`, comma separated. */
export const reachedLinks = (collections) =>
  collections
    .map(
      (c) =>
        `[${code(c.collection)}](content-types/${c.collection}.md)${operationsSuffix(c.operations)}`,
    )
    .join(', ')

/**
 * Why a call skips access, in the words of the comment above the function that makes it. The
 * comment describes that function, so one that covers several operations is said once, with them.
 */
export const reasonLines = (collections, who = '') =>
  collections
    .flatMap((c) => {
      const byText = new Map()
      for (const { operation, text } of c.why) {
        byText.set(text, [...(byText.get(text) ?? []), operation])
      }
      return [...byText].map(
        ([text, operations]) =>
          `\n- ${who}${code(c.collection)}, ${[...new Set(operations)].join(' and ')}, from the comment on the function that makes the call: ${cell(text)}`,
      )
    })
    .join('')

export const COUNTED_CALLS_SENTENCE = `The calls counted are ${COUNTED_CALLS.map(code).join(', ')}.`
