import { Check } from 'lucide-react'
import React, { type ReactNode } from 'react'

import { cn } from '@/platform/lib/cn'
import { Button } from '@/platform/ui/Button'
import { Card } from '@/platform/ui/Card'
import { Field } from '@/platform/ui/Field.client'
import { Text } from '@/platform/ui/Text'

export type RoughEstimatorProps = {
  /** One line at the top of the card: what the estimate starts from */
  intro: string
  /** The home value box's text, as typed */
  value: string
  onValueChange: (value: string) => void
  /** Whether the typed value is a new number to estimate: the check-mark button is off otherwise */
  canEstimate: boolean
  /** The reader pressed the check-mark button, or Enter in the box */
  onEstimate: () => void
  /** Why the box's text is no value, or nothing */
  error?: string
  /** The tax years the reader can pick between, one button each */
  options: readonly { key: string; label: string; note?: string }[]
  /** The index of the picked option */
  selected: number
  onSelect: (index: number) => void
  /**
   * The notes under the buttons. A note that is not `shown` still takes its room, hidden from
   * everyone, so the card is as tall as it will ever be and nothing moves when one shows.
   */
  notes: readonly { key: string; text: ReactNode; shown: boolean }[]
}

/**
 * The tool at the top of a whole-bill picture (#1022): a compact orange card, named Rough
 * Estimator for screen readers but with no title drawn, with the home value box, one button for
 * each tax year (a year can carry a short note under its button, such as "proposed", and every
 * button keeps the room for one), and the notes that say how rough the answer is. The box has a
 * check-mark button inside it at its end (#1110): off, flat and muted, while the typed value is not
 * a new number, and on, accent-colored and slightly raised once it is (Enter in the box does the
 * same), so on a phone it sits right above the keyboard (#1087). The year buttons share the row
 * with the box where the card is wide enough and stack under it before anything wraps. It draws
 * what it is given and keeps no state of its own.
 */
export function RoughEstimator({
  intro,
  value,
  onValueChange,
  canEstimate,
  onEstimate,
  error,
  options,
  selected,
  onSelect,
  notes,
}: RoughEstimatorProps) {
  return (
    <Card as="section" variant="accent" aria-label="Rough Estimator" className="h-full">
      <div className="flex h-full flex-col gap-4">
        <Text variant="small">{intro}</Text>
        <form
          className="@container my-auto"
          onSubmit={(event) => {
            event.preventDefault()
            if (canEstimate) onEstimate()
          }}
        >
          <div data-estimator-row className="flex flex-col gap-4 @lg:flex-row @lg:items-start">
            <Field
              label="Your home’s assessed value"
              error={error}
              layout="bar"
              actionPlacement="inside"
              className="@lg:flex-1"
              action={
                <Button
                  type="submit"
                  variant="action"
                  size="icon-sm"
                  aria-label="Estimate"
                  disabled={!canEstimate}
                  iconStart={<Check aria-hidden="true" />}
                />
              }
            >
              <Field.Money value={value} onValueChange={onValueChange} enterKeyHint="go" />
            </Field>
            {options.length > 1 && (
              // From @lg the label above the box is 32 px tall (24 px line, 8 px gap): the buttons start level with the box
              <div
                role="group"
                aria-label="Tax rates to use"
                className="grid grid-cols-2 gap-x-2 @lg:mt-8 @lg:flex-none"
              >
                {options.map((option, index) => (
                  <div key={option.key} className="space-y-1">
                    <Button
                      variant={index === selected ? 'accent' : 'accent-outline'}
                      size="lg"
                      aria-pressed={index === selected}
                      fullWidth
                      onClick={() => onSelect(index)}
                    >
                      {option.label}
                    </Button>
                    {options.some((other) => other.note) && (
                      <p
                        data-switch-note
                        className="min-h-5 text-center text-sm text-muted-foreground"
                      >
                        {option.note ? `(${option.note})` : ''}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </form>
        <ul className="list-disc space-y-1 pl-5 text-sm text-foreground">
          {notes.map((note) => (
            <li
              key={note.key}
              className={cn(!note.shown && 'invisible')}
              aria-hidden={note.shown ? undefined : true}
            >
              {note.text}
            </li>
          ))}
        </ul>
      </div>
    </Card>
  )
}
