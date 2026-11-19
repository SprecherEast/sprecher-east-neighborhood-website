/*
 * Which banners this visitor closed, kept on their browser only (#814). It holds the block ids of
 * closed banners and nothing else: no personal data, a strictly functional preference. Every
 * read and write is wrapped, as in `InitTheme`, so blocked storage (a private window) just shows
 * the banner: a banner never hides content because storage failed.
 */
export const DISMISSED_BANNERS_KEY = 'sprecher-east:dismissed-banners'

function readIds(): string[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(DISMISSED_BANNERS_KEY) ?? '[]')
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : []
  } catch {
    return []
  }
}

export function isBannerDismissed(id: string): boolean {
  return readIds().includes(id)
}

export function rememberBannerDismissed(id: string): void {
  try {
    const ids = readIds()
    if (ids.includes(id)) return
    localStorage.setItem(DISMISSED_BANNERS_KEY, JSON.stringify([...ids, id]))
  } catch {
    // Storage is blocked: the banner closes for this visit only
  }
}
