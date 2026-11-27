/** The ids in a relationship's value, whether Payload gave ids or loaded documents. */
export function idsOf(
  value: readonly (number | { id: number } | null | undefined)[] | null | undefined,
): number[] {
  return (value ?? []).flatMap((item) => {
    if (typeof item === 'number') return [item]
    return item && typeof item === 'object' ? [item.id] : []
  })
}
