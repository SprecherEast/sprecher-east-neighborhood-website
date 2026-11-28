/**
 * The body of a request as text, read no further than `maxBytes`, or null when it is bigger. The
 * body is counted as it arrives, so a request that never says its length (chunked) is cut off
 * after the limit, not read in full first.
 */
export async function readLimitedBody(request: Request, maxBytes: number): Promise<string | null> {
  const reader = request.body?.getReader()
  if (!reader) return ''
  const chunks: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > maxBytes) {
      await reader.cancel()
      return null
    }
    chunks.push(value)
  }
  const bytes = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return new TextDecoder().decode(bytes)
}
