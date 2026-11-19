import { describe, expect, it } from 'vitest'

import { eventPlace, ONLINE_LABEL, UNCONFIRMED_LABEL } from './place'

describe('eventPlace', () => {
  it('names the venue when the event has one', () => {
    expect(eventPlace({ locationType: 'in-person', locationName: 'Park shelter' })).toEqual({
      kind: 'venue',
      label: 'Park shelter',
    })
  })

  it('falls back to the street address when there is no venue name', () => {
    expect(
      eventPlace({
        locationType: 'in-person',
        locationName: null,
        locationAddress: '4605 Sprecher Rd',
      }),
    ).toEqual({ kind: 'venue', label: '4605 Sprecher Rd' })
  })

  it('says "Online" for a virtual event, whatever place text was left behind', () => {
    const online = { kind: 'online', label: ONLINE_LABEL }
    expect(eventPlace({ locationType: 'virtual', locationName: null })).toEqual(online)
    expect(eventPlace({ locationType: 'virtual', locationName: 'Old hall' })).toEqual(online)
  })

  it.each(['in-person', 'hybrid', null] as const)(
    'says the location is to be confirmed for a %s event with no venue',
    (locationType) => {
      expect(eventPlace({ locationType, locationName: null })).toEqual({
        kind: 'unconfirmed',
        label: UNCONFIRMED_LABEL,
      })
    },
  )

  it('treats blank text as no venue', () => {
    expect(
      eventPlace({ locationType: 'in-person', locationName: '  ', locationAddress: '' }),
    ).toEqual({
      kind: 'unconfirmed',
      label: UNCONFIRMED_LABEL,
    })
  })
})
