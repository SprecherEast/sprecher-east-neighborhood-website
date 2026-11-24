import { describe, expect, it } from 'vitest'
import { z } from 'zod'

import { describeInput } from './inputSchema.mjs'

const schemaOf = (shape) => z.toJSONSchema(z.object(shape), { io: 'input' })
const note = (shape, name) => describeInput(schemaOf(shape)).find((f) => f.name === name).note

describe('describeInput', () => {
  it('gives the type, whether it is required and the description', () => {
    const fields = describeInput(
      schemaOf({
        title: z.string().describe('The title.'),
        flag: z.boolean().nullable().optional(),
      }),
    )
    expect(fields).toEqual([
      { name: 'title', type: 'string', required: 'yes', note: 'The title' },
      { name: 'flag', type: 'boolean or null', required: 'no', note: '' },
    ])
  })

  it('reads the limits of a field that may be null from inside its null branch', () => {
    const shape = {
      venue: z.string().min(1).max(200).nullable().optional(),
      id: z.number().int().min(1).nullable().optional(),
      kind: z.enum(['a', 'b']).nullable().optional(),
      code: z
        .string()
        .regex(/^[a-f0-9]{64}$/)
        .nullable(),
    }
    expect(note(shape, 'venue')).toBe('1 to 200 characters')
    expect(note(shape, 'id')).toBe('a value of at least 1')
    expect(note(shape, 'kind')).toBe('one of a, b')
    expect(note(shape, 'code')).toBe('matches `^[a-f0-9]{64}$`')
  })

  it('reads the limits and pattern of every item of an array, and of its object items', () => {
    const shape = {
      slugs: z
        .array(
          z
            .string()
            .max(5)
            .regex(/^[a-z]+$/),
        )
        .min(1)
        .max(2),
      audience: z.array(z.enum(['x', 'y'])).max(2),
      evidence: z
        .array(
          z.object({ url: z.string().max(9), says: z.string().min(1), at: z.string().optional() }),
        )
        .max(5),
    }
    expect(note(shape, 'slugs')).toBe(
      '1 to 2 items; each item: at most 5 characters, matches `^[a-z]+$`',
    )
    expect(note(shape, 'audience')).toBe('at most 2 items; each item: one of x, y')
    expect(note(shape, 'evidence')).toBe(
      'at most 5 items; each item has `url` (string, at most 9 characters); `says` (string, not empty); `at` (string, optional)',
    )
  })

  it('says a lower limit alone, and a format', () => {
    expect(note({ list: z.array(z.string()).min(2), word: z.string().min(3) }, 'list')).toBe(
      'at least 2 items',
    )
    expect(note({ word: z.string().min(3) }, 'word')).toBe('at least 3 characters')
    expect(note({ mail: z.email() }, 'mail')).toContain('format email')
  })

  it('says a number may be limited on both sides', () => {
    expect(note({ n: z.number().min(1).max(9) }, 'n')).toBe('a value from 1 to 9')
    expect(note({ n: z.number().max(9) }, 'n')).toBe('a value of at most 9')
  })

  it('reads the rarer keywords: exclusive bounds, a step, a fixed value, no repeats, a default (#1461)', () => {
    const [field] = describeInput({
      properties: {
        n: {
          type: 'number',
          exclusiveMinimum: 0,
          exclusiveMaximum: 10,
          multipleOf: 2,
          const: 4,
          default: 4,
        },
      },
    })
    expect(field.note).toBe(
      'a value above 0; a value below 10; a multiple of 2; always 4; default 4',
    )
    const [list] = describeInput({
      properties: { list: { type: 'array', items: { type: 'string' }, uniqueItems: true } },
    })
    expect(list.note).toBe('no repeated items')
    const [strict] = describeInput({
      properties: { o: { type: 'object', additionalProperties: false, properties: {} } },
    })
    expect(strict.note).toBe('no other fields')
    expect(
      describeInput({ properties: { z: { type: 'number', const: 0, default: 0 } } })[0].note,
    ).toBe('always 0; default 0')
  })
})
