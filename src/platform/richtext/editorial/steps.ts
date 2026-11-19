import type { ResolvedLink } from '@/platform/lib'
import type { StepsBlock as StoredSteps } from '@/payload-types'

import { toEditorialLink } from './editorialLink'

/** One step, as the steps block draws it. */
export type Step = {
  heading: string
  body: string | null
  link: ResolvedLink | null
}

/** The steps block's props: plain data (decision 0013). */
export type StepsProps = {
  steps: Step[]
}

/** The stored block as the steps' props. Steps without a heading are dropped. */
export function toStepsProps(stored: Pick<StoredSteps, 'steps'>): StepsProps {
  const steps = (stored.steps ?? []).flatMap((step): Step[] => {
    const heading = step.heading?.trim()
    if (!heading) return []
    return [
      {
        heading,
        body: step.body?.trim() || null,
        link: toEditorialLink(step.linkUrl, step.linkLabel),
      },
    ]
  })
  return { steps }
}
