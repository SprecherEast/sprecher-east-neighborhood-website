import { describe, expect, it } from 'vitest'

import { configOf, entry, field } from '../testing/previewCopyFixtures'
import { findClassificationProblems } from '../testing/previewCopyGate'

/** The preview copy gate looking inside rich-text editors (#1395). */

describe('inside a rich-text editor', () => {
  // The real shape: one `blocks` feature carries both lists; a feature that is off is absent
  const richText = (
    blocks: unknown[],
    linkTargets: string[] | null = ['things'],
    extra: [string, unknown][] = [],
    inlineBlocks: unknown[] = [],
  ) => ({
    name: 'body',
    type: 'richText',
    editor: {
      editorConfig: {
        resolvedFeatureMap: new Map<string, unknown>([
          ['blocks', { sanitizedServerFeatureProps: { blocks, inlineBlocks } }],
          [
            'link',
            { sanitizedServerFeatureProps: { enabledCollections: linkTargets ?? undefined } },
          ],
          ...extra.map(
            ([key, props]) => [key, { sanitizedServerFeatureProps: props }] as [string, unknown],
          ),
        ]),
      },
    },
  })
  const withUsers = (fields: unknown[]) => ({
    collections: [
      ...configOf(fields).collections,
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
      await findClassificationProblems(configOf([richText([clean])]), entry(['body'])),
    ).toEqual([])
    const inner = richText([{ slug: 'secret', fields: [{ name: 'a', type: 'email' }] }])
    const outer = { slug: 'wrapper', fields: [inner] }
    expect(
      await findClassificationProblems(configOf([richText([outer])]), entry(['body'])),
    ).toEqual(['things.body: kept, but it holds an email field (a); it must be cleared'])
  })

  it('fails on an email field or a link to accounts inside an inline block', async () => {
    const inline = {
      slug: 'contactChip',
      fields: [
        { name: 'contactEmail', type: 'email' },
        { name: 'who', type: 'relationship', relationTo: 'users' },
      ],
    }
    expect(
      await findClassificationProblems(withUsers([richText([], ['things'], [], [inline])]), {
        ...entry(['body']),
        ...users,
      }),
    ).toEqual([
      'things.body: kept, but it holds an email field (contactEmail); it must be cleared',
      'things.body: kept, but it points at users, which is not copied',
    ])
  })

  it('treats a link feature with no enabled collections as every collection', async () => {
    const everything = withUsers([richText([], null)])
    expect(await findClassificationProblems(everything, { ...entry(['body']), ...users })).toEqual([
      'things.body: kept, but it points at users, which is not copied',
    ])
    const field = richText([], null, [])
    const feature = field.editor.editorConfig.resolvedFeatureMap.get('link') as {
      sanitizedServerFeatureProps: object
    }
    feature.sanitizedServerFeatureProps = { disabledCollections: ['users'] }
    expect(
      await findClassificationProblems(withUsers([field]), { ...entry(['body']), ...users }),
    ).toEqual([])
  })

  it('fails on a relationship feature that can point at a collection that is not copied', async () => {
    const field = richText(
      [],
      ['things'],
      [['relationship', { enabledCollectionSlugs: ['users'] }]],
    )
    expect(
      await findClassificationProblems(withUsers([field]), { ...entry(['body']), ...users }),
    ).toEqual(['things.body: kept, but it points at users, which is not copied'])
  })

  it('lists a problem once however many fields repeat it', async () => {
    const twice = withUsers([
      { name: 'wrap', type: 'group', fields: [richText([], ['users']), richText([], ['users'])] },
    ])
    expect(await findClassificationProblems(twice, { ...entry(['wrap']), ...users })).toEqual([
      'things.wrap: kept, but it points at users, which is not copied',
    ])
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
