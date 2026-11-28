/**
 * The page the sign-in callback answers once the person is signed in (#188): it sends them on to
 * `path` itself, rather than with a redirect. The provider sent the browser back with a cross-site
 * navigation, and a redirect would carry that on. A page on this site that moves on (a meta
 * refresh, or the link) makes the next request same-origin, so no cross-site rule, Payload's or
 * ours, can drop the new sign-in. (Up to Payload 3.91, Payload's CSRF check ignored the cookie on
 * a cross-site visit, the page's first reason; from 3.94 it accepts it.) No script.
 * `path` is one of the module's own paths, never input.
 */
export function continuePage(path: string): Response {
  const href = path.replace(/[^A-Za-z0-9/_-]/g, '')
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="robots" content="noindex">
<meta name="referrer" content="no-referrer">
<meta name="color-scheme" content="light dark">
<meta http-equiv="refresh" content="0;url=${href}">
<title>Signing you in — Sprecher East</title>
</head>
<body>
<p><a href="${href}">Continue to your account</a></p>
</body>
</html>`
  return new Response(html, {
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
  })
}
