import React from 'react'

import { cn } from '@/platform/lib/cn'
import { Link } from '@/platform/ui/Link'

import type { Step, StepsProps } from './steps'

/**
 * Numbered steps joined by a line (#508), following the USWDS process list: an ordered list, each
 * step a heading and a short body. Screen readers hear "Step 2: …" from a hidden prefix in the
 * heading; the circles show the number visually and, with the line, are decoration. `role="list"`
 * because Safari drops list semantics from a list without bullets.
 */
export function Steps({ steps, className }: StepsProps & { className?: string }) {
  if (steps.length === 0) return null
  return (
    <ol role="list" className={cn('not-prose my-8 w-full', className)}>
      {steps.map((step, index) => (
        <StepItem
          key={`${index}-${step.heading}`}
          step={step}
          number={index + 1}
          last={index === steps.length - 1}
        />
      ))}
    </ol>
  )
}

function StepItem({ step, number, last }: { step: Step; number: number; last: boolean }) {
  return (
    <li className={cn('relative pl-14', !last && 'pb-8')}>
      {!last && (
        <span
          aria-hidden="true"
          className="absolute top-11 bottom-1 left-5 -ml-px border-l-2 border-primary/40"
        />
      )}
      <span
        aria-hidden="true"
        className="absolute top-0 left-0 flex size-10 items-center justify-center rounded-full bg-primary-fill text-base font-bold text-primary-foreground"
      >
        {number}
      </span>
      <h3 className="pt-1.5 text-lg leading-snug font-semibold text-pretty text-foreground">
        <span className="sr-only">Step {number}: </span>
        {step.heading}
      </h3>
      {step.body && (
        <p className="mt-1 max-w-prose text-base leading-relaxed text-foreground">{step.body}</p>
      )}
      {step.link && (
        <p className="mt-2 text-base">
          <Link href={step.link.href} external={step.link.external}>
            {step.link.label}
          </Link>
        </p>
      )}
    </li>
  )
}
