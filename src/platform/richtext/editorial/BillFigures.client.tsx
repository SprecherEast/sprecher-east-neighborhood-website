'use client'

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

import { joinLastWords } from '@/platform/lib/joinLastWords'

import { fillFigures, type BillFigures } from './billFigures'

type Store = {
  /** What each tab shows before anything is typed: the average home's, as the server wrote it */
  initial: Record<string, BillFigures | undefined>
  /** What the whole bill a tab holds says now, per tab; absent while it shows the average home */
  current: Record<string, BillFigures | undefined>
  report: (tab: string, figures: BillFigures | undefined) => void
}

const FiguresContext = createContext<Store | null>(null)

/**
 * Shares each tab's City figures between its button and its heading, which sit apart in the tab
 * list and the panel (#1029). The whole bill in a panel reports the figures for the home estimated
 * and the year chosen; the button and the heading read them. Rendered on the server with the
 * average home's figures, so nothing flashes wrong before scripts run.
 */
export function BillFiguresProvider({
  initial,
  children,
}: {
  initial: Store['initial']
  children: ReactNode
}) {
  const [current, setCurrent] = useState<Store['current']>({})
  // One function for good, so a bill reporting again never makes itself report again
  const report = useCallback<Store['report']>(
    (tab, figures) => setCurrent((all) => ({ ...all, [tab]: figures })),
    [],
  )
  const value = useMemo<Store>(() => ({ initial, current, report }), [initial, current, report])
  return <FiguresContext value={value}>{children}</FiguresContext>
}

/** A tab's figures now: the bill's if it has reported, else the average home's, else none */
function useFigures(tab: string): BillFigures | undefined {
  const store = useContext(FiguresContext)
  return store?.current[tab] ?? store?.initial[tab]
}

/**
 * Reports the figures a tab's whole bill shows; the tab's text follows. A value that is not valid
 * never gets here: the bill keeps the last estimate. On leaving, the tab goes back to the average
 * home's figures, as the bill does when it is drawn again.
 */
export function useReportFigures(tab: string | undefined, figures: BillFigures | undefined) {
  const report = useContext(FiguresContext)?.report
  const yearly = figures?.yearly
  const monthly = figures?.monthly
  useEffect(() => {
    if (!tab || !report || yearly === undefined || monthly === undefined) return
    report(tab, { yearly, monthly })
    return () => report(tab, undefined)
  }, [tab, report, yearly, monthly])
}

/**
 * A tab's text with `{yearly}` and `{monthly}` written out for the home and year shown. Text
 * without them, or in a tab with no whole tax bill, shows as written. `keepLastWords` ties the
 * last two words (a tab button's figure, #707).
 */
export function FilledText({
  tab,
  text,
  keepLastWords,
}: {
  tab: string
  text: string
  keepLastWords?: boolean
}) {
  const filled = fillFigures(text, useFigures(tab))
  return <>{keepLastWords ? joinLastWords(filled) : filled}</>
}
