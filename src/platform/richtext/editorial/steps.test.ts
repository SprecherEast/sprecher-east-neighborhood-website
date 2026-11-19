import { describe, expect, it } from 'vitest'

import { toStepsProps } from './steps'

describe('toStepsProps', () => {
  it('maps stored steps to plain props, trimmed, with resolved links', () => {
    expect(
      toStepsProps({
        steps: [
          {
            heading: ' Join the meeting ',
            body: ' Ask for dates. ',
            linkLabel: 'Register',
            linkUrl: '/events',
          },
          { heading: 'Tell your alder', body: '' },
        ],
      }),
    ).toEqual({
      steps: [
        {
          heading: 'Join the meeting',
          body: 'Ask for dates.',
          link: { href: '/events', label: 'Register', external: false, appearance: 'default' },
        },
        { heading: 'Tell your alder', body: null, link: null },
      ],
    })
  })

  it('drops steps without a heading', () => {
    expect(toStepsProps({ steps: [{ heading: ' ' }, { heading: 'Vote' }] }).steps).toHaveLength(1)
  })
})
