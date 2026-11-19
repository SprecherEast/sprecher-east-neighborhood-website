import React from 'react'

import { formatDateTime } from '@/platform/lib/formatDateTime'
import { AreaChart } from '@/platform/ui/AreaChart'
import { Card } from '@/platform/ui/Card'
import { Text } from '@/platform/ui/Text'

import { activityByDay } from '../domain/dayFilter'
import { ROLLING_DAYS } from '../domain/mapWindow'
import { RECENT_DAYS } from '../domain/stats'
import { DayFilterMap } from './DayFilterMap.client'
import { planSeries } from '../domain/series'
import type { Plan } from '../domain/types'

const sum = (values: number[]) => values.reduce((total, value) => total + value, 0)

type GraphProps = {
  name: string
  /** The one small figure beside the title */
  figure: number
  figureId: string
  children: React.ReactNode
}

function Graph({ name, figure, figureId, children }: GraphProps) {
  return (
    <Card variant="muted" padding="sm" className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <Text variant="label" as="span">
          {name}
        </Text>
        <span data-testid={`figure-${figureId}`}>
          <Text variant="subsection" as="span" className="tabular-nums">
            {figure}
          </Text>
        </span>
      </div>
      {children}
    </Card>
  )
}

/**
 * The top of the plan: three graphs over the last four weeks (finished per day, done in all, still
 * open) and an activity map of the same days, with no sentences to read. A phone stacks the graphs,
 * a tablet puts finished on top and the other two side by side, a desktop puts all three in a row.
 */
export function PlanSummary({ plan, now }: { plan: Plan; now: Date }) {
  const { days, finished, doneTotal, open } = planSeries(plan, now, ROLLING_DAYS)
  const list = (values: number[]) => values.join(', ')
  const issues = [...plan.milestones.flatMap((m) => m.epics), ...plan.unscheduled].flatMap(
    (epic) => epic.children,
  )
  const activity = activityByDay(issues)
  const since = Object.keys(activity).sort()[0] ?? null

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <div className="md:col-span-2 lg:col-span-1">
          <Graph
            name="Finished per day"
            figure={sum(finished.slice(-RECENT_DAYS.week))}
            figureId="finished"
          >
            <AreaChart
              values={finished}
              days={days}
              tone="done"
              label={`Finished each day over the last four weeks: ${list(finished)}`}
            />
          </Graph>
        </div>
        <Graph name="Done in all" figure={doneTotal.at(-1) ?? 0} figureId="done">
          <AreaChart
            values={doneTotal}
            days={days}
            tone="done"
            fromZero={false}
            label={`Done in all, each day over the last four weeks: ${list(doneTotal)}`}
          />
        </Graph>
        <Graph name="Still open" figure={open.at(-1) ?? 0} figureId="open">
          <AreaChart
            values={open}
            days={days}
            tone="open"
            fromZero={false}
            label={`Still open, each day over the last four weeks: ${list(open)}`}
          />
        </Graph>
      </div>
      <Text variant="small">Updated {formatDateTime(plan.generatedAt)}.</Text>
      <DayFilterMap activity={activity} now={now} since={since} />
    </div>
  )
}
