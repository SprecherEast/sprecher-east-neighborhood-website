/**
 * What a preview may copy from the published site (#1395, part of #1077). The only place that
 * says so: the export and the server step read it and none repeats it.
 *
 * It is an allowlist. A collection or global missing from it is `excluded` by construction, so a
 * new one copies nothing until someone decides here. `classification.test.ts` fails when the
 * Payload config and this file disagree.
 *
 * Plain data and lookups, no Payload import, so the privileged copy step can load it from `main`.
 */

/** Written by the database or Payload itself, never by an editor; copied with the document. */
export const SYSTEM_FIELDS = ['id', 'createdAt', 'updatedAt', '_status'] as const

/** The file's own metadata, which an upload collection adds; copied with the picture's record. */
export const UPLOAD_FIELDS = [
  'url',
  'thumbnailURL',
  'filename',
  'mimeType',
  'filesize',
  'width',
  'height',
  'focalX',
  'focalY',
  'sizes',
] as const

export type PreviewCopyEntry =
  | {
      copy: 'copied'
      reason: string
      /**
       * Top-level fields that are public and copied. Anything beyond these fields' own children
       * is never read. A field of the config in neither list fails the gate.
       */
      keep: readonly string[]
      /** Top-level fields present in the schema and deliberately left empty in the copy. */
      clear: readonly string[]
      /**
       * `published`: only what a visitor sees is read. `all`: the collection has no drafts. Either
       * way, main documents only: version tables (`_versions`) are never copied.
       */
      reads: 'published' | 'all'
    }
  /** A derived index, built again from the copied documents (search). */
  | { copy: 'rebuilt'; reason: string }
  | { copy: 'excluded'; reason: string }

const copied = (
  reason: string,
  keep: readonly string[],
  options: { clear?: readonly string[]; reads?: 'published' | 'all' } = {},
): PreviewCopyEntry => ({
  copy: 'copied',
  reason,
  keep,
  clear: options.clear ?? [],
  reads: options.reads ?? 'published',
})
const excluded = (reason: string): PreviewCopyEntry => ({ copy: 'excluded', reason })

/** Where the fields of one document's search-engine tab live, shared by three collections. */
const SEO = 'meta'

export const PREVIEW_COPY: Readonly<Record<string, PreviewCopyEntry>> = {
  // Published content: what a visitor sees
  pages: copied('Published page layouts are the real shapes a shared component must fit.', [
    'title',
    'hero',
    'layout',
    SEO,
    'publishedAt',
    'slug',
    'generateSlug',
    'backdrop',
  ]),
  posts: copied(
    'Published news posts, with the byline and source a reader sees.',
    [
      'title',
      'heroImage',
      'backdrop',
      'content',
      'relatedPosts',
      'relatedEvents',
      'categories',
      SEO,
      'publishedAt',
      'populatedAuthors',
      'slug',
      'generateSlug',
      'sourceName',
      'sourceUrl',
      'audience',
    ],
    {
      // `authors` points at accounts, which are never copied; the review queue's own fields are
      // internal bookkeeping (and `externalId` and `contentHash` are unique keys)
      clear: ['authors', 'moderationStatus', 'externalId', 'contentHash'],
    },
  ),
  events: copied(
    'Published events, the calendar and the cards.',
    [
      'title',
      'date',
      'timeStart',
      'timeEnd',
      'cancelled',
      'officialBody',
      'agendaUrl',
      'featured',
      'locationType',
      'locationName',
      'locationAddress',
      'mapsUrl',
      'registrationUrl',
      'heroImage',
      'backdrop',
      'description',
      'content',
      'categories',
      SEO,
      'publishedAt',
      'slug',
      'generateSlug',
      'sourceName',
      'sourceUrl',
      'audience',
    ],
    { clear: ['moderationStatus', 'externalId', 'contentHash', 'relatedPosts'] },
  ),
  categories: copied(
    'The shared category tree posts and events point at.',
    ['title', 'slug', 'generateSlug', 'defaultImage', 'parent', 'breadcrumbs'],
    { reads: 'all' },
  ),
  'team-members': copied(
    'Public board and agent profiles; the address is staff-only and left empty.',
    ['memberType', 'name', 'role', 'title', 'bio', 'capabilities', 'status', 'order', 'photo'],
    { clear: ['email'], reads: 'all' },
  ),
  resources: copied('Published resource listings.', [
    'title',
    'description',
    'url',
    'links',
    'phone',
    'category',
    'photo',
    'photoCredit',
    'photoSourceUrl',
    'order',
    'publishedAt',
  ]),
  faq: copied('Published questions and answers.', [
    'question',
    'answer',
    'category',
    'order',
    'publishedAt',
  ]),
  media: copied(
    'Only the pictures that copied documents point at (the export follows those references, not every record); the file itself is linked by the server step.',
    ['alt', 'caption', 'credit', 'license', 'licenseUrl', 'sourceUrl'],
    // Admin folders are not copied (below), so the link is left empty
    { clear: ['folder'], reads: 'all' },
  ),
  forms: copied(
    'The contact form is a page block: its fields must render; recipients and templates are staff-only.',
    ['title', 'fields', 'submitButtonLabel', 'confirmationType', 'confirmationMessage', 'redirect'],
    { clear: ['emails'], reads: 'all' },
  ),
  header: copied('The header navigation.', ['navItems'], { reads: 'all' }),
  footer: copied('The footer navigation and forum link.', ['navItems', 'forumUrl'], {
    reads: 'all',
  }),

  // A derived index: built again from the copied documents, never copied
  search: {
    copy: 'rebuilt',
    reason: 'Derived from posts and events; rebuilt so it never holds a stale or private copy.',
  },

  // Accounts and everything tied to a person
  users: excluded('Accounts: names, emails, roles, sessions and password hashes.'),
  passkeys: excluded('Keys tied to an account.'),
  'passkey-challenges': excluded('One-time sign-in challenges.'),
  'social-link-requests': excluded('Pending Google links: a provider subject and email.'),
  'email-confirmations': excluded('Addresses typed into public forms.'),
  'form-submissions': excluded('Messages and sender emails from neighbors.'),
  'payload-mcp-api-keys': excluded('Agent keys: credentials.'),
  'payload-preferences': excluded('Each signed-in user’s admin settings.'),
  'payload-locked-documents': excluded('Who is editing what: account references.'),
  'agent-runs': excluded('Run history of the AI agents.'),
  'agent-review-items': excluded('What agents asked editors to review.'),

  // Not published content, or built by the preview itself
  redirects: excluded(
    'Not published content, and a copied redirect could send a preview’s own pages away; the preview does not need it to judge a component.',
  ),
  'payload-folders': excluded(
    'Admin-only organising of media, invisible to visitors; the media folder link is cleared.',
  ),
  'payload-jobs': excluded('The jobs queue: queued work and its inputs.'),
  'payload-jobs-stats': excluded('Jobs queue counters.'),
  'payload-kv': excluded('Internal key-value store (rate counters, locks).'),
  'payload-migrations': excluded('The preview builds its own from the pull request’s migrations.'),
}

/** The entry for a slug, or the excluded default: nothing is copied until it is listed. */
export function previewCopyEntry(slug: string): PreviewCopyEntry {
  return PREVIEW_COPY[slug] ?? { copy: 'excluded', reason: 'Not classified.' }
}

/** Slugs of the copied collections and globals, in a stable order. */
export function copiedSlugs(): string[] {
  return Object.entries(PREVIEW_COPY)
    .filter(([, entry]) => entry.copy === 'copied')
    .map(([slug]) => slug)
    .sort()
}
