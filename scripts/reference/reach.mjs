/**
 * What the code of a tool or a task reaches, as the functions the pages' loader hands to the tools
 * and jobs readers (#1461): each one fixes the program, the repository root and the known
 * collections, and passes the rest of what the reader needs through.
 */
import { findCollectionCalls } from './collectionCalls.mjs'

/** The config file the functions that tasks are given are found in (the retention keepers). */
export const CONFIG_FILE = 'src/payload.config.ts'

/** `(file, name)`: the collections the handler of the tool `name` in `file` reaches. */
export const toolReach =
  ({ program, root }, knownSlugs) =>
  (file, name) =>
    findCollectionCalls(program, root, file, { name, knownSlugs })

/**
 * `(file, name, hook)`: the collections the handler of the task `name` in `file` reaches, or those
 * of the function `hook` there, following the functions the config file passes into the task.
 */
export const taskReach =
  ({ program, root }, knownSlugs, configFile = CONFIG_FILE) =>
  (file, name, hook) =>
    findCollectionCalls(program, root, file, { name, hook, configFile, knownSlugs })
