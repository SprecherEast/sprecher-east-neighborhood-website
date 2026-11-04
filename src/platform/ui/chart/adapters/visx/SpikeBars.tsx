import React from 'react'
import { AxisBottom } from '@visx/axis'
import { Group } from '@visx/group'
import { PatternLines } from '@visx/pattern'
import { scaleLinear } from '@visx/scale'
import { Bar } from '@visx/shape'

/** Spike (#663): one visx bar chart as a server component, to prove no @visx code reaches a client chunk */
export function SpikeBars() {
  const x = scaleLinear({ domain: [0, 500], range: [0, 300] })
  return (
    <svg role="img" aria-label="Spike" viewBox="0 0 320 90" className="w-full max-w-md">
      <PatternLines
        id="spike-hatch"
        width={5}
        height={5}
        orientation={['diagonal']}
        className="stroke-background"
        strokeWidth={1.5}
      />
      <Group left={10} top={5}>
        <Bar
          x={0}
          y={0}
          width={x(452.7)}
          height={14}
          rx={4}
          className="fill-chart-1"
          data-chart-mark="a"
        />
        <Bar
          x={0}
          y={30}
          width={x(477.5)}
          height={14}
          rx={4}
          className="fill-chart-1"
          data-chart-mark="b"
        />
        <Bar x={0} y={30} width={x(477.5)} height={14} rx={4} fill="url(#spike-hatch)" />
        <g transform="translate(0,60)">
          <AxisBottom
            scale={x}
            tickValues={[0, 250, 500]}
            hideAxisLine
            tickLabelProps={{ className: 'fill-muted-foreground text-[10px]' }}
          />
        </g>
      </Group>
    </svg>
  )
}
