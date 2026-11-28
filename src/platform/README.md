# Platform

Code every module uses: pure helpers (`lib/`), Payload setup, role checks and the media collection
(`payload/`), UI primitives (`ui/`), light and dark mode (`theme/`), rich text (`richtext/`), and
email, the robot check, the visit counter, SEO and the service wrapper (`email/`, `turnstile/`,
`analytics/`, `seo/`, `service/`). It imports no module, so any module can depend on it.

The full list and the rules are in
[`docs/architecture/`](../../docs/architecture/README.md#business-areas).
