// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { HeatMap } from './HeatMap'

afterEach(cleanup)

const cells = (c: HTMLElement) => [...c.querySelectorAll('[data-heat-cell]')] as HTMLElement[]

describe('HeatMap a finished period', () => {
  const month = ['2026-10-29', '2026-10-30', '2026-10-31']

  it('leaves the days after the last one empty, not dashed, when nothing is still to come', () => {
    const { container } = render(
      <HeatMap variant="calendar" days={month} values={[1, 1, 1]} label="x" toCome={false} />,
    )
    expect(container.querySelectorAll('[data-heat-future]')).toHaveLength(0)
    expect(container.querySelectorAll('[data-heat-cell]')).toHaveLength(3)
  })

  it('rings no day when today is null, and the given day when one is named', () => {
    const none = render(
      <HeatMap variant="calendar" days={month} values={[1, 1, 1]} label="x" today={null} />,
    )
    expect(cells(none.container).filter((c) => c.className.includes('ring-2'))).toHaveLength(0)
    cleanup()
    const named = render(
      <HeatMap variant="calendar" days={month} values={[1, 1, 1]} label="x" today="2026-10-30" />,
    )
    expect(cells(named.container).filter((c) => c.className.includes('ring-2'))).toEqual([
      cells(named.container)[1],
    ])
  })
})
