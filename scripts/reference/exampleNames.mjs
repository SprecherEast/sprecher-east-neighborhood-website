/** How an example is named and where its file is (#1532): one definition for the reader, the index and the tests. */

/** The words of an export name: `SecondTabOpen` is "Second tab open". */
export function exampleTitle(name) {
  const words = name.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

/** The link name of an example (the part after the `#`): `SecondTabOpen` is `second-tab-open`. */
export const exampleAnchor = (name) =>
  name
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')

/** The two examples files a component file may have: server examples and, beside them, client ones. */
export function examplesFilesFor(componentFile) {
  const stem = componentFile.replace(/(\.client)?\.tsx$/, '')
  return [
    { file: `${stem}.examples.tsx`, kind: 'server' },
    { file: `${stem}.examples.client.tsx`, kind: 'client' },
  ]
}
