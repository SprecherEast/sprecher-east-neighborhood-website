import type { OutcomeForkBlock as StoredOutcomeFork } from '@/payload-types'

import { isOutcomeTone, type OutcomeTone } from './outcomeTone'

/** One possible answer, as the fork draws it. */
export type Outcome = {
  title: string
  tone: OutcomeTone
  description: string | null
}

/** The outcome fork's props: plain data (decision 0013). */
export type OutcomeForkProps = {
  question: string
  outcomes: Outcome[]
}

/**
 * The stored block as the fork's props. Outcomes without a title are dropped, and an unknown
 * tone reads as `open`. A fork needs a question and two outcomes; with fewer it's not a fork, and
 * the props come back empty so nothing is drawn.
 */
export function toOutcomeForkProps(
  stored: Pick<StoredOutcomeFork, 'question' | 'outcomes'>,
): OutcomeForkProps {
  const question = stored.question?.trim() ?? ''
  const outcomes = (stored.outcomes ?? []).flatMap((outcome): Outcome[] => {
    const title = outcome.title?.trim()
    if (!title) return []
    return [
      {
        title,
        tone: isOutcomeTone(outcome.tone) ? outcome.tone : 'open',
        description: outcome.description?.trim() || null,
      },
    ]
  })
  if (!question || outcomes.length < 2) return { question: '', outcomes: [] }
  return { question, outcomes }
}
