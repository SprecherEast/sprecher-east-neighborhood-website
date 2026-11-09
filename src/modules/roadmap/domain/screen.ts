/*
 * What the public plan leaves out (the owner's choice, 2026-11-09, #939): issues labeled for
 * server work or waiting on him, and any whose text holds a server address, an email address or
 * plug-and-play plans. One rule, so the tree and the issue page can't disagree.
 */
export const HIDDEN_LABELS = ['infra', 'needs owner'] as const

const IPV4 = /(?<![\d.])(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)(?![\d.])/
const EMAIL = /[^\s@<>()[\]]+@[^\s@<>()[\]]+\.[A-Za-z]{2,}/
const PLUG_AND_PLAY = /plug[\s-]+and[\s-]+play/i

type Screenable = { labels: string[]; title: string; body: string }

export function isShownPublicly({ labels, title, body }: Screenable): boolean {
  const names = labels.map((label) => label.trim().toLowerCase())
  if (names.some((name) => (HIDDEN_LABELS as readonly string[]).includes(name))) return false
  const text = `${title}\n${body}\n${labels.join('\n')}`
  return !IPV4.test(text) && !EMAIL.test(text) && !PLUG_AND_PLAY.test(text)
}
