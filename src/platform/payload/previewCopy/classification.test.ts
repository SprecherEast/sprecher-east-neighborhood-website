import type { SanitizedConfig } from 'payload'
import { beforeAll, describe, expect, it } from 'vitest'

import { loadConfig } from '../testing/accessHarness'
import { findClassificationProblems } from '../testing/previewCopyGate'
import { copiedSlugs, PREVIEW_COPY, previewCopyEntry } from './classification'

/**
 * The gate for what a preview may copy (#1395): loads the real config with no database and
 * fails when it and the allowlist disagree.
 */

let config: SanitizedConfig
beforeAll(async () => {
  config = await loadConfig()
}, 60_000)

describe('the real config', () => {
  it('is fully classified, and every copied field is public or cleared', async () => {
    expect(await findClassificationProblems(config)).toEqual([])
  })

  it('copies nothing personal', () => {
    const personal = [
      'users',
      'passkeys',
      'passkey-challenges',
      'social-link-requests',
      'email-confirmations',
      'form-submissions',
      'payload-mcp-api-keys',
      'payload-preferences',
      'payload-locked-documents',
      'agent-runs',
      'agent-review-items',
      'payload-jobs',
    ]
    for (const slug of personal) expect(previewCopyEntry(slug).copy, slug).toBe('excluded')
  })

  it('reads only the published version where drafts exist', () => {
    for (const slug of ['pages', 'posts', 'events', 'faq', 'resources']) {
      const entry = PREVIEW_COPY[slug]
      expect(entry?.copy === 'copied' && entry.reads).toBe('published')
    }
  })

  it('clears the addresses and staff-only fields', () => {
    const cleared = (slug: string) => {
      const entry = PREVIEW_COPY[slug]
      return entry?.copy === 'copied' ? entry.clear : []
    }
    expect(cleared('team-members')).toContain('email')
    expect(cleared('forms')).toContain('emails')
    expect(cleared('posts')).toContain('authors')
  })

  it('lists copied slugs, and an unlisted slug is excluded', () => {
    expect(copiedSlugs()).toContain('pages')
    expect(copiedSlugs()).not.toContain('users')
    expect(previewCopyEntry('some-new-collection').copy).toBe('excluded')
  })
})

describe('the gate', () => {
  const field = (name: string, extra: object = {}) => ({ name, type: 'text', ...extra })
  const open = () => true
  const config = (fields: unknown[], extra: object = {}) => ({
    collections: [{ slug: 'things', fields, access: { read: open }, ...extra }],
    globals: [],
  })
  const entry = (keep: string[], clear: string[] = [], reads: 'all' | 'published' = 'all') => ({
    things: { copy: 'copied' as const, reason: 'A test collection.', keep, clear, reads },
  })

  it('fails on a collection with no class, and on a class with no collection', async () => {
    expect(await findClassificationProblems(config([field('a')]), {})).toEqual([
      'things: not classified (add it to PREVIEW_COPY)',
    ])
    expect(
      await findClassificationProblems(
        { collections: [], globals: [] },
        { gone: { copy: 'excluded', reason: 'A removed collection.' } },
      ),
    ).toEqual(['gone: classified, but not in the config any more'])
  })

  it('fails on a new field nobody decided on', async () => {
    const problems = await findClassificationProblems(
      config([field('a'), field('b')]),
      entry(['a']),
    )
    expect(problems).toEqual(['things.b: new field, decide keep or clear'])
  })

  it('looks through layout containers and counts a named group once', async () => {
    const fields = [
      { type: 'row', fields: [field('a')] },
      { type: 'tabs', tabs: [{ fields: [field('b')] }, { name: 'meta', fields: [field('c')] }] },
    ]
    expect(await findClassificationProblems(config(fields), entry(['a', 'b', 'meta']))).toEqual([])
  })

  it('fails on a kept email field, however deeply nested, and passes once cleared', async () => {
    const fields = [
      field('a'),
      { name: 'contact', type: 'group', fields: [{ name: 'x', type: 'email' }] },
    ]
    expect(await findClassificationProblems(config(fields), entry(['a', 'contact']))).toEqual([
      'things.contact: kept, but it holds an email field (x); it must be cleared',
    ])
    expect(await findClassificationProblems(config(fields), entry(['a'], ['contact']))).toEqual([])
  })

  it('fails on a field named like an email, and on a hidden one', async () => {
    const fields = [field('replyToEmail'), field('token', { hidden: true })]
    expect(
      await findClassificationProblems(config(fields), entry(['replyToEmail', 'token'])),
    ).toEqual([
      'things.replyToEmail: kept, but it holds an email field (replyToEmail); it must be cleared',
      'things.token: kept, but it has a hidden field (token); it must be cleared',
    ])
  })

  it('fails on a kept field only staff may read, and allows one the public may read', async () => {
    const staff = ({ req }: { req: { user?: { role?: string } | null } }) =>
      req.user?.role === 'admin' || req.user?.role === 'editor'
    const open = () => true
    const fields = [
      field('note', { access: { read: staff } }),
      field('open', { access: { read: open } }),
    ]
    expect(await findClassificationProblems(config(fields), entry(['note', 'open']))).toEqual([
      'things.note: kept, but it has a staff-only read field (note); it must be cleared',
    ])
  })

  it('fails on a copied collection with drafts that does not read published only', async () => {
    const drafts = { versions: { drafts: true } }
    expect(await findClassificationProblems(config([field('a')], drafts), entry(['a']))).toEqual([
      'things: has drafts, so it must read the published version only',
    ])
    expect(
      await findClassificationProblems(config([field('a')], drafts), entry(['a'], [], 'published')),
    ).toEqual([])
  })

  it('fails on a copied collection a visitor may not read, such as an admin-only one', async () => {
    const adminOnly = ({ req }: { req: { user?: { role?: string } | null } }) =>
      req.user?.role === 'admin'
    expect(
      await findClassificationProblems(
        config([field('a')], { access: { read: adminOnly } }),
        entry(['a']),
      ),
    ).toEqual(['things: copied, but a visitor may not read it on the site'])
    expect(
      await findClassificationProblems(config([field('a')], { access: {} }), entry(['a'])),
    ).toEqual(['things: copied, but a visitor may not read it on the site'])
  })

  it('judges a field by what a visitor sees, so a field open to residents only is private', async () => {
    const residents = ({ req }: { req: { user?: unknown } }) => Boolean(req.user)
    const fields = [field('perk', { access: { read: residents } })]
    expect(await findClassificationProblems(config(fields), entry(['perk']))).toEqual([
      'things.perk: kept, but it has a staff-only read field (perk); it must be cleared',
    ])
  })

  describe('inside a rich-text editor', () => {
    const richText = (blocks: unknown[], linkTargets: string[] = ['things']) => ({
      name: 'body',
      type: 'richText',
      editor: {
        editorConfig: {
          resolvedFeatureMap: new Map([
            ['blocks', { sanitizedServerFeatureProps: { blocks } }],
            ['link', { sanitizedServerFeatureProps: { enabledCollections: linkTargets } }],
          ]),
        },
      },
    })
    const withUsers = (fields: unknown[]) => ({
      collections: [
        ...config(fields).collections,
        { slug: 'users', fields: [], access: { read: () => false } },
      ],
      globals: [],
    })
    const users = { users: { copy: 'excluded' as const, reason: 'Accounts, never copied.' } }

    it('fails on an email field or a link to accounts inside an editor block', async () => {
      const block = {
        slug: 'contactCard',
        fields: [
          { name: 'contactEmail', type: 'email' },
          { name: 'who', type: 'relationship', relationTo: 'users' },
        ],
      }
      expect(
        await findClassificationProblems(withUsers([richText([block])]), {
          ...entry(['body']),
          ...users,
        }),
      ).toEqual([
        'things.body: kept, but it holds an email field (contactEmail); it must be cleared',
        'things.body: kept, but it points at users, which is not copied',
      ])
    })

    it('passes a clean editor block, and finds a nested block inside a block', async () => {
      const clean = { slug: 'note', fields: [field('text')] }
      expect(
        await findClassificationProblems(config([richText([clean])]), entry(['body'])),
      ).toEqual([])
      const inner = richText([{ slug: 'secret', fields: [{ name: 'a', type: 'email' }] }])
      const outer = { slug: 'wrapper', fields: [inner] }
      expect(
        await findClassificationProblems(config([richText([outer])]), entry(['body'])),
      ).toEqual(['things.body: kept, but it holds an email field (a); it must be cleared'])
    })

    it('fails on a link feature that can point at a collection that is not copied', async () => {
      expect(
        await findClassificationProblems(withUsers([richText([], ['things', 'users'])]), {
          ...entry(['body']),
          ...users,
        }),
      ).toEqual(['things.body: kept, but it points at users, which is not copied'])
    })
  })

  it('fails on a kept link to a collection that is not copied', async () => {
    const fields = [{ name: 'owner', type: 'relationship', relationTo: ['users'] }]
    const classification = {
      ...entry(['owner']),
      users: { copy: 'excluded' as const, reason: 'Accounts, never copied.' },
    }
    const withUsers = {
      ...config(fields),
      collections: [...config(fields).collections, { slug: 'users', fields: [] }],
    }
    expect(await findClassificationProblems(withUsers, classification)).toEqual([
      'things.owner: kept, but it points at users, which is not copied',
    ])
  })

  it('needs a reason, and a listed field to still exist', async () => {
    const bad = {
      things: {
        copy: 'copied' as const,
        reason: '',
        keep: ['a', 'gone'],
        clear: [],
        reads: 'all' as const,
      },
    }
    expect(await findClassificationProblems(config([field('a')]), bad)).toEqual([
      'things: needs a reason',
      'things.gone: listed, but not a field any more',
    ])
  })
})
