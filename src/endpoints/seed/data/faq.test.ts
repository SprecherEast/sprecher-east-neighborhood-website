import { describe, expect, it } from 'vitest'

import { faqItems } from './faq'

/** Every piece of text in a rich-text value, so a test reads what a neighbor reads */
function textOf(value: unknown): string {
  if (Array.isArray(value)) return value.map(textOf).join('')
  if (value && typeof value === 'object') {
    const node = value as Record<string, unknown>
    return [typeof node.text === 'string' ? node.text : '', ...Object.values(node).map(textOf)].join(
      '',
    )
  }
  return ''
}

const answerTo = (question: string) =>
  textOf(faqItems.find((item) => item.question === question)?.answer)

describe('FAQ seed matches the live site (#1010)', () => {
  const everything = faqItems.map((item) => `${item.question} ${textOf(item.answer)}`).join(' ')

  it('names no model or company, and says "we" and "neighbor"', () => {
    expect(everything).not.toMatch(/Claude|Anthropic|Gemini|Grok|ChatGPT/)
    const answers = faqItems.map((item) => textOf(item.answer)).join(' ')
    expect(answers).not.toMatch(/(?<![\w-])(I|me|my)(?![\w-])/)
    expect(everything).not.toMatch(/resident/i)
    expect(everything).toContain('AI tools')
  })

  it('asks "Do I need to join or pay?" once, and has no entry about what membership costs', () => {
    expect(faqItems.filter((item) => item.question === 'Do I need to join or pay?')).toHaveLength(1)
    expect(answerTo('Do I need to join or pay?')).toBe(
      'No. There’s no membership, no sign-up and no dues. Read the site, and send us a note if you’d like to share something or help.',
    )
    expect(faqItems.map((item) => item.question)).not.toContain('How do I join?')
    expect(everything).not.toMatch(/be a member/)
  })

  it('uses no membership category', () => {
    expect(faqItems.some((item) => item.category === 'membership')).toBe(false)
  })

  it('says the site is unofficial and speaks for no association', () => {
    expect(answerTo('Is Sprecher East an official neighborhood association?')).toBe(
      'No. This is an unofficial site run by one neighbor. It doesn’t speak for any association.',
    )
    expect(everything).not.toMatch(/initiative|grassroots|represent residents/i)
  })

  it('says who runs it and how AI helps, in the live words', () => {
    expect(answerTo('Who runs this?')).toBe(
      'Amine Boulaajaj, a neighbor here, with AI tools doing research and drafting. The About page has more.',
    )
    expect(answerTo('Does AI help build this website?')).toBe(
      'Yes. We use AI tools to research, draft and organize what’s here. A neighbor reviews what gets published, and longer pieces say what they’re based on.',
    )
  })

  it('points to the City’s Report a Problem tool and the contact form', () => {
    const entry = faqItems.find((item) => item.question === 'How do I report a neighborhood issue?')
    const json = JSON.stringify(entry?.answer)
    expect(json).toContain('https://www.cityofmadison.com/reportaproblem/')
    expect(json).toContain('/contact')
  })
})
