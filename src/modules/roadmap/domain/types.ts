/** An issue as the GitHub reader hands it over: only what the rules and the page need. */
export type RawIssue = {
  number: number
  title: string
  body: string
  state: 'open' | 'closed'
  /** GitHub's reason for a closed issue; `not_planned` means "we decided not to" */
  stateReason: string | null
  /** When it was closed, as GitHub gives it; `null` while open */
  closedAt: string | null
  labels: string[]
  milestoneNumber: number | null
  url: string
}

export type RawMilestone = {
  number: number
  title: string
  description: string
  state: 'open' | 'closed'
  dueOn: string | null
}

/** An epic and the issues GitHub lists as its sub-issues */
export type RawEpic = { epic: RawIssue; children: RawIssue[] }

export type PlanIssueState = 'open' | 'done' | 'not-planned'

export type PlanIssue = {
  number: number
  title: string
  state: PlanIssueState
  labels: string[]
  description: string
  url: string
  closedAt: string | null
}

export type PlanEpic = PlanIssue & { children: PlanIssue[] }

export type PlanMilestone = Omit<RawMilestone, 'number'> & {
  number: number
  epics: PlanEpic[]
}

export type Plan = {
  /** When we read the plan from GitHub (an ISO time), so the page can say how fresh it is */
  generatedAt: string
  milestones: PlanMilestone[]
  /** Epics that belong to no milestone */
  unscheduled: PlanEpic[]
  /** Issues left out because they are screened out, epics and their issues included */
  hiddenCount: number
}
