// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { expectAccessible } from '@/platform/ui/testing/expectAccessible'

import { BillShare } from './BillShare.client'
import { box, city, estimate, PROPS } from './billShareFixtures'

afterEach(cleanup)

const receipt = () => document.querySelector('[data-pie-legend]') as HTMLElement

describe('BillShare', () => {
  it('starts on the latest year with the City’s average home for it', () => {
    render(<BillShare {...PROPS}>City detail</BillShare>)
    expect(box().value).toBe('$500,300')
    expect(screen.getByRole('button', { name: /2027 rates/ }).getAttribute('aria-pressed')).toBe(
      'true',
    )
    expect(screen.getByText('City detail')).toBeTruthy()
  })

  it('says the City’s rate for a year is proposed, without naming the other bodies, in a note that is always there', () => {
    render(<BillShare {...PROPS}>x</BillShare>)
    const note = screen.getByText(/City’s 2027 tax rate is proposed/i)
    expect(note.textContent).toBe('The City’s 2027 tax rate is proposed, not confirmed.')
    expect(note.closest('li')?.getAttribute('aria-hidden')).toBeNull()
    expect(screen.getByText('(proposed)')).toBeTruthy()
    // Last year's rates have nothing to confirm: the note keeps its room and is hidden from everyone
    fireEvent.click(screen.getByRole('button', { name: /2026 rates/ }))
    const kept = screen.getByText(/City’s 2027 tax rate is proposed/i).closest('li')
    expect(kept?.getAttribute('aria-hidden')).toBe('true')
    expect(kept?.className).toContain('invisible')
    expect(screen.getByText(/a rough estimate/i)).toBeTruthy()
  })

  it('shows the bill for the home value typed, only once Estimate is pressed', async () => {
    render(<BillShare {...PROPS}>x</BillShare>)
    fireEvent.click(screen.getByRole('button', { name: /2026 rates/ }))
    expect(box().value).toBe('$481,300')
    const result = screen.getByRole('status')
    expect(result.textContent).toMatch(/\$481,300/)
    expect(result.textContent).toMatch(/about \$8,9\d\d/)
    fireEvent.change(box(), { target: { value: '962600' } })
    // Typing changes nothing: the numbers and the spoken sentence wait for Estimate
    expect(screen.getByRole('status').textContent).toMatch(/\$481,300/)
    expect(receipt().textContent).toMatch(/For a home valued at \$481,300/)
    await estimate('962600')
    expect(receipt().textContent).toMatch(/For a home valued at \$962,600/)
    expect(receipt().textContent).toMatch(/Total property tax\$17,9\d\d/)
    expect(screen.getByRole('status').textContent).toMatch(/about \$17,9\d\d/)
  })

  it('keeps what the reader typed when the year changes', () => {
    render(<BillShare {...PROPS}>x</BillShare>)
    fireEvent.change(box(), { target: { value: '300000' } })
    fireEvent.click(screen.getByRole('button', { name: /2026 rates/ }))
    expect(box().value).toBe('$300,000')
  })

  it('asks for a number, keeps the last bill and leaves Estimate off', () => {
    render(<BillShare {...PROPS}>x</BillShare>)
    fireEvent.change(box(), { target: { value: 'abc' } })
    expect(screen.getByRole('alert').textContent).toMatch(/enter your home’s value/i)
    expect((screen.getByRole('button', { name: 'Estimate' }) as HTMLButtonElement).disabled).toBe(
      true,
    )
    expect(screen.getByRole('status').textContent).toMatch(/\$500,300/)
  })

  it('turns Estimate on only for a valid value that differs from the one shown', async () => {
    render(<BillShare {...PROPS}>x</BillShare>)
    const button = () => screen.getByRole('button', { name: 'Estimate' }) as HTMLButtonElement
    expect(button().disabled).toBe(true)
    fireEvent.change(box(), { target: { value: '300000' } })
    expect(button().disabled).toBe(false)
    await estimate('300000')
    expect(button().disabled).toBe(true)
    expect(screen.getByRole('status').textContent).toMatch(/\$300,000/)
  })

  it('estimates when Enter submits the box', async () => {
    render(<BillShare {...PROPS}>x</BillShare>)
    fireEvent.change(box(), { target: { value: '400000' } })
    await act(async () => {
      fireEvent.submit(box().closest('form') as HTMLFormElement)
    })
    expect(screen.getByRole('status').textContent).toMatch(/\$400,000/)
  })

  it('applies a rate year at once while a typed value waits for Estimate', () => {
    render(<BillShare {...PROPS}>x</BillShare>)
    fireEvent.change(box(), { target: { value: '300000' } })
    fireEvent.click(screen.getByRole('button', { name: /2026 rates/ }))
    expect(screen.getByRole('status').textContent).toMatch(/\$481,300/)
    expect(box().value).toBe('$300,000')
  })

  it('draws the whole bill as one pie of the four bodies, with the source', () => {
    render(<BillShare {...PROPS}>x</BillShare>)
    fireEvent.click(screen.getByRole('button', { name: /2026 rates/ }))
    const pie = screen.getByRole('img', { name: /^Your rough property tax:/ })
    const label = pie.getAttribute('aria-label') ?? ''
    for (const name of [
      'Madison schools',
      'City of Madison',
      'Dane County',
      'Madison College (MATC)',
    ]) {
      expect(label).toContain(name)
    }
    expect(label).toMatch(/City of Madison \$[\d,]+, 38%/)
    expect(screen.getByRole('link', { name: /City tax detail/ })).toBeTruthy()
  })

  it('lists the bill as a receipt: the home, the City first, then the others, then the total', () => {
    render(<BillShare {...PROPS}>x</BillShare>)
    fireEvent.click(screen.getByRole('button', { name: /2026 rates/ }))
    const rows = Array.from(receipt().querySelectorAll('li')).map((li) => li.textContent)
    expect(receipt().firstElementChild?.textContent).toBe('For a home valued at $481,300')
    expect(rows.map((row) => row?.replace(/[$\d,%]+/g, '').trim())).toEqual([
      'City of Madison',
      'Madison schools',
      'Dane County',
      'Madison College (MATC)',
    ])
    expect(receipt().lastElementChild?.textContent).toMatch(/^Total property tax\$8,9\d\d$/)
    // The receipt replaces the sentence above the pie: only the screen-reader status still says it
    const said = screen.queryAllByText(/your whole bill is about/)
    expect(said.every((node) => node.closest('[role="status"]'))).toBe(true)
    const label = screen.getByRole('img', { name: /^Your rough property tax:/ })
    expect(label.getAttribute('aria-label')).toMatch(/^Your rough property tax: City of Madison/)
  })

  it('puts the Rough Estimator and the pie in two cards, and the City’s panel under both', () => {
    render(
      <BillShare {...PROPS} {...city}>
        <p>The rest</p>
      </BillShare>,
    )
    const estimator = screen.getByRole('heading', { name: 'Rough Estimator' })
    const pie = screen.getByRole('heading', { name: 'Your rough property tax' })
    const panel = screen.getByText('Short line')
    const follows = (a: Node, b: Node) =>
      a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING
    expect(follows(estimator, pie)).toBeTruthy()
    expect(follows(pie, panel)).toBeTruthy()
  })

  it('has no accessibility violations', async () => {
    const { container } = render(<BillShare {...PROPS}>City detail</BillShare>)
    await expectAccessible(container)
  })
})

describe('BillShare, Estimate with motion allowed', () => {
  afterEach(() => vi.unstubAllGlobals())

  const allowMotion = (visible: boolean) => {
    vi.stubGlobal('matchMedia', () => ({ matches: false }))
    const scroll = vi.fn()
    Element.prototype.scrollIntoView = scroll
    const top = visible ? 100 : 5000
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
      top,
      bottom: top + 300,
      left: 0,
      right: 300,
      width: 300,
      height: 300,
      x: 0,
      y: top,
      toJSON: () => ({}),
    })
    return scroll
  }

  it('does not scroll when the receipt is already fully on screen', async () => {
    const scroll = allowMotion(true)
    render(<BillShare {...PROPS}>x</BillShare>)
    await estimate('300000')
    expect(scroll).not.toHaveBeenCalled()
    expect(screen.getByRole('status').textContent).toMatch(/\$300,000/)
  })

  it('scrolls smoothly to the receipt when it is out of view', async () => {
    const scroll = allowMotion(false)
    render(<BillShare {...PROPS}>x</BillShare>)
    await estimate('300000')
    expect(scroll).toHaveBeenCalledWith({ behavior: 'smooth', block: 'nearest' })
  })
})
