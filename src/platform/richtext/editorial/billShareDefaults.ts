import type { BillToastDefinition, BillToastId } from './billToasts'
import type { NoteCondition } from './billShareNotes'

/**
 * The starting text of a whole-bill block (#1158). A new block starts with it in Admin, where an
 * editor changes any of it; a block stored before the text became fields has none of its own yet
 * and shows it until it is saved. It is the one place this wording is typed: the page draws only
 * what the block holds, and the code decides only when a note shows.
 */
export const DEFAULT_BILL_ROW_TITLES = {
  breakdown: 'Your City tax breakdown',
  differ: 'Why your bill may differ',
  sources: 'Sources',
} as const

/**
 * The rates panel's starting titles (#1351, #1417): the year's rates when every rate is its own, and
 * the City's rate in a year that carries the other bodies' rates over from an earlier year.
 */
export const DEFAULT_BILL_RATES = {
  title: '{year} rates',
  carriedTitle: '{year} city rate',
} as const

/**
 * The starting toasts of a whole-bill block (#1379): what each says and how it ends. The code asks
 * for one by its id; the editor changes any of it in Admin, and empties a message to turn that
 * toast off. `{year}` is the year shown. The rates toasts say which year's rates the bill uses, so
 * they wait for the reader to accept them: what the bill is based on is not small print.
 * The own-rates toast starts with no message, so it is off: a year whose rates are all its own needs
 * no notice, and an editor who wants one writes its message (#1392). The `about` toasts open only
 * when the reader presses a panel's Estimate button (#1417), so they never count toward the limit
 * of times a visit shows the rates warnings.
 */
export const DEFAULT_BILL_TOASTS: Record<BillToastId, BillToastDefinition> = {
  ratesCarried: {
    tone: 'warning',
    title: '',
    message:
      'These are the City’s {year} rates. The others aren’t out yet, so we’re using {carried}’s.',
    ending: 'accept',
    placement: 'panel',
    showsPerVisit: 2,
    fadeSeconds: 5,
    acceptLabel: 'Got it',
  },
  ratesOwn: {
    tone: 'info',
    title: '',
    message: '',
    ending: 'accept',
    placement: 'panel',
    showsPerVisit: 2,
    fadeSeconds: 5,
    acceptLabel: 'Got it',
  },
  aboutAnswer: {
    tone: 'warning',
    title: '',
    message:
      'This is the City’s share of your bill, from its {year} rate. It’s an estimate, not a bill.',
    ending: 'accept',
    placement: 'panel',
    showsPerVisit: 2,
    fadeSeconds: 5,
    acceptLabel: 'Got it',
  },
  aboutRates: {
    tone: 'warning',
    title: '',
    message: 'These are the {year} rates we used. Your real bill may differ.',
    ending: 'accept',
    placement: 'panel',
    showsPerVisit: 2,
    fadeSeconds: 5,
    acceptLabel: 'Got it',
  },
  aboutBill: {
    tone: 'warning',
    title: '',
    message: 'This adds up every body’s share. It’s an estimate, so your real bill may differ.',
    ending: 'accept',
    placement: 'panel',
    showsPerVisit: 2,
    fadeSeconds: 5,
    acceptLabel: 'Got it',
  },
}

type DefaultNote = {
  showWhen: NoteCondition
  text: string
  linkLabel?: string
  linkUrl?: string
}

export const DEFAULT_BILL_NOTES: readonly DefaultNote[] = [
  {
    showWhen: 'always',
    text: 'A rough estimate by neighbors with AI help. It isn’t official or tax advice.',
  },
  {
    showWhen: 'always',
    text: 'The City’s assessed value of your home may differ from the one you enter.',
  },
  {
    showWhen: 'always',
    text: 'Credits, exemptions, who owns the home and the type of property change a real bill.',
  },
  { showWhen: 'always', text: 'Uses {year} rates.' },
  {
    showWhen: 'earlierYears',
    text: 'We assume your home’s {years} value changed as much as the average home’s.',
  },
  { showWhen: 'proposedRate', text: 'The City’s {year} tax rate is proposed and may change.' },
  {
    showWhen: 'missingRates',
    text: '{bodies} have no rates to use, so the whole bill can’t be shown.',
  },
  {
    showWhen: 'always',
    text: 'If your real bill comes out far from this, please {link}.',
    linkLabel: 'send us a note',
    linkUrl: '/contact',
  },
]
