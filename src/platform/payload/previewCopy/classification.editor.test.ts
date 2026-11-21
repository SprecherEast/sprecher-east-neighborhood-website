import { describe, expect, it } from 'vitest'

import {
  accountsOnly,
  blocksFeature,
  configOf,
  entry,
  feature,
  field,
  lexical,
  plainFeature,
  withUsers,
} from '../testing/previewCopyFixtures'
import { findClassificationProblems } from '../testing/previewCopyGate'

/** The preview copy gate looking inside rich-text editors, blocks and block references (#1395). */

const emailField = { name: 'contactEmail', type: 'email' }
const toUsers = { name: 'who', type: 'relationship', relationTo: 'users' }
const EMAIL = 'things.body: kept, but it holds an email field (contactEmail); it must be cleared'
const USERS = 'things.body: kept, but it points at users, which is not copied'
const gate = (config: ReturnType<typeof configOf>) =>
  findClassificationProblems(config, {
    ...entry(['body']),
    ...(config.collections.some((c) => c.slug === 'users') ? accountsOnly : {}),
  })

describe('inside a rich-text editor', () => {
  const card = { slug: 'contactCard', fields: [emailField, toUsers] }

  it('fails on an email field or a link to accounts inside a block or an inline block', async () => {
    expect(await gate(withUsers([lexical({ blocks: blocksFeature([card]) })]))).toEqual([
      EMAIL,
      USERS,
    ])
    expect(
      await gate(withUsers([lexical({ blocks: blocksFeature([], [card] as never) })])),
    ).toEqual([EMAIL, USERS])
  })

  it('passes a clean block, and finds a block inside a block and rich text inside a block', async () => {
    const clean = { slug: 'note', fields: [field('text')] }
    expect(await gate(configOf([lexical({ blocks: blocksFeature([clean]) })]))).toEqual([])
    const inner = { name: 'parts', type: 'blocks', blocks: [{ slug: 's', fields: [emailField] }] }
    expect(
      await gate(configOf([lexical({ blocks: blocksFeature([{ slug: 'w', fields: [inner] }]) })])),
    ).toEqual([EMAIL])
    const linking = lexical({ link: feature({ enabledCollections: ['users'] }) }, 'inner')
    expect(
      await gate(
        withUsers([lexical({ blocks: blocksFeature([{ slug: 'w', fields: [linking] }]) })]),
      ),
    ).toEqual([USERS])
  })

  it('walks what the link and upload features store, through their own schema maps', async () => {
    const linkFields = { fields: [emailField, toUsers] }
    const link = feature({ enabledCollections: ['things'] }, { fields: linkFields })
    expect(await gate(withUsers([lexical({ link })]))).toEqual([EMAIL, USERS])
    const upload = feature({ enabledCollections: ['things'] }, { 'things.fields': linkFields })
    expect(await gate(withUsers([lexical({ upload })]))).toEqual([EMAIL, USERS])
  })

  it('counts every collection a link, relationship or upload feature may point at', async () => {
    // A link with no list allows every collection (Payload's default), less the disabled ones
    expect(await gate(withUsers([lexical({ link: feature({}) })]))).toEqual([USERS])
    const disabled = feature({ disabledCollections: ['users'] })
    expect(await gate(withUsers([lexical({ link: disabled })]))).toEqual([])
    const enabled = feature({ enabledCollections: ['things', 'users'] })
    expect(await gate(withUsers([lexical({ link: enabled })]))).toEqual([USERS])
    const relation = feature({ enabledCollectionSlugs: ['users'] })
    expect(await gate(withUsers([lexical({ relationship: relation })]))).toEqual([USERS])
    const upload = feature({ enabledCollections: ['users'] })
    expect(await gate(withUsers([lexical({ upload })]))).toEqual([USERS])
  })

  it('lists a problem once however many fields repeat it', async () => {
    const link = (name: string) =>
      lexical({ link: feature({ enabledCollections: ['users'] }) }, name)
    const twice = withUsers([{ name: 'wrap', type: 'group', fields: [link('a'), link('b')] }])
    expect(
      await findClassificationProblems(twice, { ...entry(['wrap']), ...accountsOnly }),
    ).toEqual(['things.wrap: kept, but it points at users, which is not copied'])
  })
})

describe('block references', () => {
  const shared = { slug: 'zzContact', fields: [emailField, toUsers] }
  const byReference = (slug: string) => ({
    name: 'body',
    type: 'blocks',
    blocks: [],
    blockReferences: [slug],
  })

  it('walks a block a `blocks` field uses by slug', async () => {
    expect(await gate(withUsers([byReference('zzContact')], [shared]))).toEqual([EMAIL, USERS])
  })

  it('fails on a reference to a block that is not in the config', async () => {
    expect(await gate(configOf([byReference('missing')]))).toEqual([
      'things.body: kept, but the gate cannot read it (block reference "missing" is not in the config\'s blocks)',
    ])
  })
})

describe('failing closed', () => {
  const cannotRead = (why: string) => [`things.body: kept, but the gate cannot read it (${why})`]

  it('fails on a field type it does not know, however deep', async () => {
    const odd = { name: 'x', type: 'hologram' }
    const group = {
      name: 'body',
      type: 'group',
      fields: [{ name: 'in', type: 'row', fields: [odd] }],
    }
    expect(await gate(configOf([group]))).toEqual(cannotRead('unknown field type "hologram" (x)'))
  })

  it('fails on an unnamed container it does not know, which could hold a field', async () => {
    const hidden = { type: 'hologram', fields: [field('a')] }
    expect(await findClassificationProblems(configOf([hidden]), entry(['a']))).toEqual([
      'things: the gate cannot read its fields (unnamed field of type "hologram" is not a layout container)',
    ])
  })

  it('fails on a rich-text feature it does not know, one that cannot be read, and an unknown editor', async () => {
    expect(
      await gate(configOf([lexical({ bold: plainFeature(), newThing: plainFeature() })])),
    ).toEqual(cannotRead('unknown rich-text feature "newThing"'))
    const broken = {
      sanitizedServerFeatureProps: {},
      generateSchemaMap: () => {
        throw new Error('shape changed')
      },
    }
    expect(await gate(configOf([lexical({ blocks: broken })]))).toEqual(
      cannotRead('rich-text feature "blocks" could not be read'),
    )
    expect(await gate(configOf([{ name: 'body', type: 'richText', editor: {} }]))).toEqual(
      cannotRead('rich-text field "body" has an editor the walker does not know'),
    )
  })

  it('fails on a schema-map value of a shape it does not know, or that is not an object', async () => {
    const renamed = feature({}, { 'x.fields': { flattenedFields: [emailField] } })
    expect(await gate(configOf([lexical({ blocks: renamed })]))).toEqual(
      cannotRead('a value of an unknown shape (flattenedFields)'),
    )
    const odd = feature({}, { x: 'text' as never })
    expect(await gate(configOf([lexical({ blocks: odd })]))).toEqual(
      cannotRead('a value that is not an object'),
    )
  })

  it('fails on a container that lacks the list the walker reads, even one with a known type', async () => {
    const typed = feature(
      {},
      { 'x.fields': { type: 'group', name: 'card', flattenedFields: [emailField] } },
    )
    expect(await gate(configOf([lexical({ blocks: typed })]))).toEqual(
      cannotRead('group field "card" has no fields'),
    )
    const renamed = { name: 'body', type: 'group', flattenedFields: [emailField] }
    expect(await gate(configOf([renamed]))).toEqual(cannotRead('group field "body" has no fields'))
    const noTabs = { name: 'body', type: 'blocks', blocksList: [] }
    expect(await gate(configOf([noTabs]))).toEqual(cannotRead('blocks field "body" has no blocks'))
  })

  it('reports a null value with the intended message, not a stack trace', async () => {
    const group = { name: 'body', type: 'group', fields: [null] }
    expect(await gate(configOf([group]))).toEqual(cannotRead('a value that is not an object'))
    expect(await gate(configOf([lexical({ blocks: feature({}, { x: null as never }) })]))).toEqual(
      cannotRead('a value that is not an object'),
    )
  })

  it('knows the checklist feature, and counts a join field as pointing at its collection', async () => {
    expect(
      await gate(configOf([lexical({ bold: plainFeature(), checklist: plainFeature() })])),
    ).toEqual([])
    const join = { name: 'body', type: 'join', collection: 'users', on: 'x' }
    expect(await gate(withUsers([join]))).toEqual([USERS])
  })

  it('fails on a feature that lists collections in a shape it does not know', async () => {
    const odd = feature({ enabledCollections: { pages: true } })
    expect(await gate(withUsers([lexical({ link: odd })]))).toEqual([
      USERS,
      ...cannotRead(
        'rich-text feature "link" lists collections in a shape the walker does not know',
      ),
    ])
  })
})
