import { escapeMarkup } from './escapeMarkup'

/** An email the site sends: fixed text only, never anything a visitor typed (decision 0004). */
export type OutgoingEmail = { subject: string; text: string; html: string }

// Email clients ignore stylesheets and CSS variables, so the brand colors are inline here: the
// light theme's primary and foreground tokens (docs/guidelines/nextjs-tailwind.md#design-tokens).
const PRIMARY = '#42755e'
const FOREGROUND = '#1a1a1a'

/** Wraps paragraphs, and an optional button link, in the plain Sprecher East email layout. */
export function toEmailHtml(
  paragraphs: string[],
  button?: { label: string; href: string },
): string {
  const body = paragraphs.map((p) => `<p style="margin:0 0 16px">${escapeMarkup(p)}</p>`).join('')
  const action = button
    ? `<p style="margin:24px 0"><a href="${escapeMarkup(button.href)}" style="background:${PRIMARY};color:#ffffff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600">${escapeMarkup(button.label)}</a></p>`
    : ''
  return `<div style="font-family:Arial,sans-serif;font-size:16px;line-height:1.5;color:${FOREGROUND};max-width:560px">${body}${action}<p style="margin:24px 0 0;font-size:13px">Sprecher East, an unofficial, AI-assisted neighborhood website.</p></div>`
}
