import React, { useId, type ReactNode } from 'react'

import { cn } from '@/platform/lib/cn'
import { Button } from '@/platform/ui/Button'
import { Card, CardTitle } from '@/platform/ui/Card'
import { Field } from '@/platform/ui/Field.client'
import { Text } from '@/platform/ui/Text'

export type RoughEstimatorProps = {
  /** One line under the title: what the estimate starts from */
  intro: string
  /** The home value box's text, as typed */
  value: string
  onValueChange: (value: string) => void
  /** Whether the typed value is a new number to estimate: the button is off otherwise */
  canEstimate: boolean
  /** The reader pressed Estimate, or Enter in the box */
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
 * The tool at the top of a whole-bill picture (#1022): an orange card titled Rough Estimator, with
 * the home value box, one button for each tax year side by side (a year can carry a short note
 * under its button, such as "proposed", and every button keeps the room for one), an Estimate
 * button last, which is on only while the typed value is a new number (Enter in the box does the
 * same), and the notes that say how rough the answer is. It draws what it is given and keeps no state of its own.
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
  const titleId = useId()
  return (
    <Card as="section" variant="accent" aria-labelledby={titleId} className="h-full">
      <div className="flex h-full flex-col gap-4">
        <div className="space-y-1">
          <CardTitle as="h3" className="text-xl">
            <span id={titleId}>Rough Estimator</span>
          </CardTitle>
          <Text variant="small">{intro}</Text>
        </div>
        <form
          className="my-auto space-y-4"
          onSubmit={(event) => {
            event.preventDefault()
            if (canEstimate) onEstimate()
          }}
        >
          <Field label="Your home’s value" error={error}>
            <Field.Money value={value} onValueChange={onValueChange} enterKeyHint="go" />
          </Field>
          {options.length > 1 && (
            <div role="group" aria-label="Tax rates to use" className="grid grid-cols-2 gap-x-2">
              {options.map((option, index) => (
                <div key={option.key} className="space-y-1">
                  <Button
                    variant={index === selected ? 'accent' : 'accent-outline'}
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
          <Button type="submit" variant="primary" fullWidth disabled={!canEstimate}>
            Estimate
          </Button>
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
