import { Check } from 'lucide-react'
import React, { useId } from 'react'

import { cn } from '@/platform/lib/cn'
import { Button } from '@/platform/ui/Button'
import { Card } from '@/platform/ui/Card'
import { BAR_LABEL, Field } from '@/platform/ui/Field.client'
import { SegmentedControl } from '@/platform/ui/SegmentedControl'

export type RoughEstimatorProps = {
  /** The home value box's text, as typed */
  value: string
  onValueChange: (value: string) => void
  /** Whether the typed value is a new number to estimate: the check-mark button is off otherwise */
  canEstimate: boolean
  /** The reader pressed the check-mark button, or Enter in the box */
  onEstimate: () => void
  /** Why the box's text is no value, or nothing */
  error?: string
  /** The tax years the reader can pick between: the year numbers, as one joined control */
  options: readonly { key: string; label: string }[]
  /** The index of the picked option */
  selected: number
  onSelect: (index: number) => void
}

/**
 * The tool at the top of a whole-bill picture (#1022): a compact orange card, named Rough
 * Estimator for screen readers but with no title drawn, with the home value box and, on the same
 * row at every width, the tax years as one joined two-option control of the year numbers, as tall
 * as the box (#1118). The box has a check-mark button inside it at its end (#1110): off, flat and
 * muted, while the typed value is not a new number, and on, accent-colored and slightly raised
 * once it is (Enter in the box does the same), so on a phone it sits right above the keyboard
 * (#1087). Nothing is drawn under the years: the answer card's badge says a year's status. It
 * draws what it is given and keeps no state of its own.
 */
export function RoughEstimator({
  value,
  onValueChange,
  canEstimate,
  onEstimate,
  error,
  options,
  selected,
  onSelect,
}: RoughEstimatorProps) {
  const yearsLabelId = useId()
  return (
    <Card as="section" variant="accent" padding="xs" aria-label="Rough Estimator">
      <form
        onSubmit={(event) => {
          event.preventDefault()
          if (canEstimate) onEstimate()
        }}
      >
        <div data-estimator-row>
          <Field
            label="Your home’s assessed value"
            error={error}
            layout="bar"
            actionPlacement="inside"
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
            aside={
              options.length > 1 && (
                <>
                  <span id={yearsLabelId} className={cn(BAR_LABEL, '@[16rem]:text-right')}>
                    Tax rates
                  </span>
                  <SegmentedControl
                    className="w-full @[16rem]:w-auto"
                    labelledBy={yearsLabelId}
                    options={options}
                    selected={selected}
                    onSelect={onSelect}
                  />
                </>
              )
            }
          >
            <Field.Money value={value} onValueChange={onValueChange} enterKeyHint="go" />
          </Field>
        </div>
      </form>
    </Card>
  )
}
