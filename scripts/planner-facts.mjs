/**
 * Reads the facts the status rule needs (#1425, #1435), once for every planner script: the report
 * reads them for every card, the event moves for the one issue the event concerns. This file builds
 * the GraphQL text, turns what GitHub answers into facts and reads the branches of the claim naming
 * pattern; it never writes, and `planner-status.mjs` decides from the result.
 */
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

import { linkedIssues } from '../.github/scripts/pr-body.mjs'
import { findStatusComment, plannerSetStatus } from './planner-comment.mjs'
import { POLICY_URL, TRUSTED_ASSOCIATIONS } from './planner-config.mjs'
import { issueCheckProblems } from './planner-ready.mjs'
import { claimBranch, issueOfBranch } from './planner-status.mjs'

/** The `owner/name` of the repository a GraphQL node belongs to. */
const repositoryOf = (node) => node?.repository?.nameWithOwner

/** Runs `gh`, signed in as whoever the workflow made, and returns its answer as text. */
export const runGh = (args) =>
  execFileSync('gh', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).trim()

/** The label policy the issue check reads. */
export const readPolicy = () => JSON.parse(readFileSync(POLICY_URL, 'utf8'))

/** An issue, named by repository and number: the same number in another repository is another issue. */
export const issueKey = (repository, number) => `${repository}#${number}`

/** Arguments of a `gh api graphql` call: the query, text variables as given, numbers typed. */
export function graphqlArgs(query, strings = {}, numbers = {}) {
  return [
    'api',
    'graphql',
    '-f',
    `query=${query}`,
    ...Object.entries(strings).flatMap(([name, value]) => ['-f', `${name}=${value}`]),
    ...Object.entries(numbers).flatMap(([name, value]) => ['-F', `${name}=${value}`]),
  ]
}

/** The fields of an issue the rule reads, to put inside `... on Issue{}` or `issue(number:$n){}`. */
export const ISSUE_FIELDS = `number title body state repository{nameWithOwner}
      milestone{title} author{login __typename}
      labels(first:50){totalCount nodes{name}} assignees(first:10){totalCount nodes{login}}
      comments(last:100){totalCount nodes{databaseId body authorAssociation author{login __typename}}}
      closedByPullRequestsReferences(first:50,includeClosedPrs:true){totalCount nodes{number state merged mergedAt authorAssociation repository{nameWithOwner}}}
      timelineItems(first:100,itemTypes:[CROSS_REFERENCED_EVENT,REOPENED_EVENT]){totalCount nodes{__typename ... on ReopenedEvent{createdAt} ... on CrossReferencedEvent{source{__typename ... on PullRequest{number state merged mergedAt authorAssociation body repository{nameWithOwner}}}}}}
      parent{number state} subIssues(first:100){totalCount nodes{number state repository{nameWithOwner} projectItems(first:10){nodes{project{number owner{... on Organization{login}}}}}}}`

/** An issue has more entries in a list than one read returns, so its facts would be partial. */
export class TruncatedError extends Error {
  constructor(message, key) {
    super(message)
    this.key = key
  }
}

const nodesOf = (connection, list, issue) => {
  const nodes = connection?.nodes ?? []
  if ((connection?.totalCount ?? nodes.length) > nodes.length) {
    throw new TruncatedError(
      `#${issue.number}: its ${list} list is cut off, so it was not read in full.`,
      issueKey(repositoryOf(issue), issue.number),
    )
  }
  return nodes
}

/** Whether a comment or pull request was written by someone who can write to the repository. */
const byRepositoryPeople = (node) => TRUSTED_ASSOCIATIONS.has(node?.authorAssociation)

const pullRequestKey = (pr) => issueKey(repositoryOf(pr), pr.number)

/**
 * The pull requests that show work on the issue, keyed by repository and number: the ones GitHub
 * lists as closing it, and the ones in this repository whose description closes it (an upper
 * layer of a stack, which GitHub does not link). The description is read by the repository's one
 * parser, `linkedIssues`, so a keyword inside a comment does not count. A plain mention never does.
 */
function pullRequestsOf(issue, closing, events) {
  const here = repositoryOf(issue)
  const declared = events
    .map((event) => event.source)
    .filter(
      (pr) =>
        byRepositoryPeople(pr) &&
        typeof pr?.body === 'string' &&
        here &&
        repositoryOf(pr) === here &&
        linkedIssues(pr.body).closes.includes(issue.number),
    )
  return new Map(
    [...declared, ...closing.filter(byRepositoryPeople)].map((pr) => [pullRequestKey(pr), pr]),
  )
}

/**
 * Merged pull requests that declared they settle the issue, for the merged flag. A merge the issue
 * was reopened after is left out, because a person chose that.
 */
function mergedThatSettle(pulls, events) {
  const reopenedAt = events
    .filter((event) => event.__typename === 'ReopenedEvent')
    .map((event) => Date.parse(event.createdAt))
  return [...pulls.values()].filter(
    (pr) => pr.merged && !reopenedAt.some((at) => at > Date.parse(pr.mergedAt)),
  ).length
}

/**
 * An issue node as `{ key, repository, number, title, facts }`. `facts.remoteBranch` starts null;
 * `withRemoteBranch` fills it from the branches read for the repository. Only a comment or pull
 * request written by someone who can write to the repository counts. `appSlug` is the planner app's
 * name, used to find its own comment (`statusComment`) and the status it last set (`plannerSet`).
 */
export function factsFromIssue(issue, policy, appSlug) {
  const read = (list) => nodesOf(issue[list], list, issue)
  const labels = read('labels').map((entry) => entry.name)
  const forCheck = {
    title: issue.title,
    body: issue.body ?? '',
    state: 'open',
    labels,
    milestone: issue.milestone,
    user: { login: issue.author?.login, type: issue.author?.__typename },
  }
  const comments = read('comments')
  const statusComment = findStatusComment(
    comments.map((entry) => ({
      id: entry.databaseId,
      type: entry.author?.__typename,
      login: entry.author?.login,
      body: entry.body,
    })),
    appSlug,
  )
  const closing = read('closedByPullRequestsReferences')
  const events = read('timelineItems')
  const pulls = pullRequestsOf(issue, closing, events)
  const repository = repositoryOf(issue)
  return {
    key: issueKey(repository, issue.number),
    repository,
    number: issue.number,
    title: issue.title,
    facts: {
      state: issue.state.toLowerCase(),
      labels,
      assignees: read('assignees').map((entry) => entry.login),
      problems: issueCheckProblems(forCheck, policy),
      claimBranch: claimBranch(comments.filter(byRepositoryPeople)),
      statusComment: statusComment && { id: statusComment.id, body: statusComment.body },
      plannerSet: plannerSetStatus(statusComment?.body),
      remoteBranch: null,
      // GitHub's own list, plus a same-repository pull request whose description closes the issue
      // (an upper stack layer); a plain mention is never either
      openPullRequests: [...pulls.values()].filter((pr) => pr.state === 'OPEN' && !pr.merged)
        .length,
      mergedPullRequests: mergedThatSettle(pulls, events),
      pullRequests: pulls.size,
      subIssues: read('subIssues').map((child) => ({
        key: issueKey(repositoryOf(child), child.number),
        repository: repositoryOf(child),
        number: child.number,
        state: child.state.toLowerCase(),
        projects: (child.projectItems?.nodes ?? []).map(({ project }) => ({
          owner: project?.owner?.login,
          number: project?.number,
        })),
      })),
      parent: issue.parent && {
        number: issue.parent.number,
        state: issue.parent.state.toLowerCase(),
      },
    },
  }
}

/** The same card with the claim-named branch the remote holds for it, if any. */
export const withRemoteBranch = (card, branches) => ({
  ...card,
  facts: { ...card.facts, remoteBranch: branches.get(card.key) ?? null },
})

const BRANCHES_QUERY = `query($owner:String!,$name:String!,$cursor:String){repository(owner:$owner,name:$name){
  refs(refPrefix:"refs/heads/agent/",first:100,after:$cursor){pageInfo{hasNextPage endCursor}nodes{name}}}}`

/**
 * The branches of the claim naming pattern that a repository holds, as a Map from the issue's key
 * to the branch. Every page is read, so no branch is missed. `run` is a command runner that
 * returns the answer as text.
 */
export function readClaimBranches(run, repository) {
  const [owner, name] = repository.split('/')
  const branches = new Map()
  let cursor = null
  do {
    const args = graphqlArgs(BRANCHES_QUERY, { owner, name, ...(cursor && { cursor }) })
    const refs = JSON.parse(run(args)).data?.repository?.refs
    if (!refs) throw new Error(`Could not read the branches of ${repository}.`)
    for (const { name: ref } of refs.nodes) {
      const branch = `agent/${ref}`
      const number = issueOfBranch(branch)
      if (number !== null && !branches.has(issueKey(repository, number))) {
        branches.set(issueKey(repository, number), branch)
      }
    }
    cursor = refs.pageInfo.hasNextPage ? refs.pageInfo.endCursor : null
  } while (cursor)
  return branches
}
