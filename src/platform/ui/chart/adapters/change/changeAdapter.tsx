import React from 'react'

import { cn } from '@/platform/lib/cn'
import { formatShare } from '@/platform/lib/chart/breakdown'
import {
  formatChangeAmount,
  formatChangePercent,
  formatCompactMoney,
  toChangeView,
} from '@/platform/lib/chart/change'
import { ChangeFigure } from '@/platform/ui/ChangeFigure'
import { ShareStrip } from '@/platform/ui/ShareStrip'
import { SHARE_TONE_ORDER, SHARE_TONES } from '@/platform/ui/shareTones'
import { Text } from '@/platform/ui/Text'

import type { ChartAdapter } from '../../chartAdapter'

/**
 * The change-first look of a stacked chart (#1503): the latest figure with how much it changed
 * from the earlier row, then one slim strip of the split and its key with each part's share and
 * dollars. It is text and one slim strip, so it takes a few lines of the screen where two big bars
 * took most of it, and every figure is real text. It draws its own key, at full width.
 */
export const changeAdapter: ChartAdapter = {
  name: 'change',
  output: 'html',
  kinds: new Set<'stacked'>(['stacked']),
  accepts: (spec) => spec.kind === 'stacked' && spec.look === 'change',
  usesColour: false,
  enlargeable: false,
  render(spec) {
    if (spec.kind !== 'stacked') {
      throw new Error(`The change adapter does not draw ${spec.kind} charts`)
    }
    const { latest, earlier, change, parts } = toChangeView(spec)
    return (
      <div className="space-y-4">
        <ChangeFigure
          label={latest.label}
          value={formatCompactMoney(latest.total)}
          change={{
            direction: change.direction,
            amount: formatChangeAmount(change.amount),
            percent: formatChangePercent(change.percent),
            since: earlier.label,
          }}
        />
        <ShareStrip
          label={`${latest.label}, how it splits`}
          parts={parts.map((part, index) => ({
            name: part.label,
            percent: part.percent,
            tone: SHARE_TONE_ORDER[index],
          }))}
        />
        <ul role="list" aria-label="Chart key" className="space-y-1.5">
          {parts.map((part, index) => (
            <li
              key={part.key}
              className="grid grid-cols-[0.875rem_minmax(0,1fr)_auto_auto] items-center gap-x-2.5"
            >
              <span
                aria-hidden="true"
                data-chart-mark={part.key}
                className={cn(
                  'size-3.5 rounded-[3px] print-exact',
                  SHARE_TONES[SHARE_TONE_ORDER[index]].bg,
                )}
              />
              <Text variant="small" as="span" className="text-foreground">
                {part.label}
              </Text>
              <Text variant="small" as="span" className="w-14 text-right tabular-nums">
                {formatShare(part.percent)}
              </Text>
              <Text
                variant="small"
                as="span"
                className="w-16 text-right font-semibold text-foreground tabular-nums"
              >
                {formatCompactMoney(part.value)}
              </Text>
            </li>
          ))}
        </ul>
      </div>
    )
  },
}
