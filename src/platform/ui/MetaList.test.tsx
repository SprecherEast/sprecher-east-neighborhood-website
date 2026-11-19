// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { MapPin } from 'lucide-react'
import { afterEach, describe, expect, it } from 'vitest'

import { MetaList } from './MetaList'
import { expectAccessible } from './testing/expectAccessible'

afterEach(cleanup)

describe('MetaList', () => {
  it('is a description list when its items have labels (#432)', async () => {
    const { container } = render(
      <MetaList
        variant="on-image"
        items={[
          { label: 'Date', value: 'Tue, Mar 3, 2026' },
          { label: 'Format', value: 'In person' },
        ]}
      />,
    )

    expect(container.querySelector('dl')).not.toBeNull()
    expect(screen.getByText('Date').tagName).toBe('DT')
    expect(screen.getByText('In person').tagName).toBe('DD')
    await expectAccessible(container)
  })

  it('is a plain list with decorative icons when its items have none', async () => {
    const { container } = render(<MetaList items={[{ icon: <MapPin />, value: 'Madison, WI' }]} />)

    expect(screen.getAllByRole('listitem')).toHaveLength(1)
    expect(container.querySelector('[aria-hidden="true"] svg')).not.toBeNull()
    await expectAccessible(container)
  })

  it('takes labelled or icon items, never both in one list', () => {
    // @ts-expect-error A mixed list would be a <dl> with an item that has no <dt>
    render(<MetaList items={[{ label: 'Date', value: 'Mar 3' }, { value: 'Madison, WI' }]} />)
  })

  it('writes inline labels as "Label: value"', () => {
    render(<MetaList variant="inline" items={[{ label: 'Time', value: '6 PM' }]} />)

    expect(screen.getByText('Time').className).toContain('after:content-[":"]')
  })
})
