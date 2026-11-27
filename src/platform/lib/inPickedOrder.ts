/**
 * The items an editor picked, in the order they picked them: `items` come back from a database in
 * any order, and some picks may be missing (a document the reader may not see). Each pick is listed
 * once, and an item nobody picked is left out.
 */
export function inPickedOrder<T extends { id: number }>(
  items: readonly T[],
  pickedIds: readonly number[],
): T[] {
  const byId = new Map(items.map((item) => [item.id, item]))
  return [...new Set(pickedIds)].flatMap((id) => {
    const item = byId.get(id)
    return item ? [item] : []
  })
}
