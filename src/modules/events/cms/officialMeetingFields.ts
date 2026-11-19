import type { Field } from 'payload'

import {
  MAX_AGENDA_URL_LENGTH,
  OFFICIAL_BODIES,
  validateAgendaUrl,
} from '../domain/officialMeetings'

/**
 * An official meeting's body and agenda link, in the event's details (#122). Both are optional;
 * the agenda link shows only once a body is chosen, and must be a full `https://` link.
 */
export const officialMeetingFields: Field = {
  type: 'row',
  fields: [
    {
      name: 'officialBody',
      type: 'select',
      label: 'Official meeting of',
      options: [...OFFICIAL_BODIES],
      admin: {
        width: '33%',
        description:
          'Set for a public body’s own meeting (Common Council, a city commission, the County Board).',
      },
    },
    {
      name: 'agendaUrl',
      type: 'text',
      label: 'Official agenda link',
      maxLength: MAX_AGENDA_URL_LENGTH,
      validate: validateAgendaUrl,
      admin: {
        width: '66%',
        condition: (data) => Boolean(data?.officialBody),
        placeholder: 'https://…',
        description: 'The body’s own agenda page, starting with https://',
      },
    },
  ],
}
