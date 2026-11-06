# Roles

Role guides describe a focus area of the work on this site: its mission, what good looks like, and
its checklists. Any agent, or any human, can take on a role by reading its guide; nothing here
depends on a particular tool or model.

[`AGENTS.md`](../../AGENTS.md), the [guidelines](../guidelines/README.md) and
[`docs/architecture/`](../architecture/README.md) win wherever a role guide disagrees with them. If
you find a disagreement, fix the role guide in the same PR.

Role guides are policy files, as they were when they lived in `.claude/agents/`: the review calls
out a change to one, and a change the owner didn't ask for waits for him
([`AGENTS.md`](../../AGENTS.md), step 3).

| Role                       | Guide                                     | Use it for                                                               |
| -------------------------- | ----------------------------------------- | ------------------------------------------------------------------------ |
| Backend Engineer           | [`backend-eng`](backend-eng.md)           | Server-side features, API endpoints, auth flows, email, data processing. |
| CMS Engineer               | [`cms-eng`](cms-eng.md)                   | Collections, content templates, admin workflows, CMS data in pages.      |
| Content Strategist         | [`content-lead`](content-lead.md)         | Writing, editing or planning content; editorial direction.               |
| Events Manager             | [`events-mgr`](events-mgr.md)             | Adding events, event features, sourcing local happenings.                |
| Frontend Engineer          | [`frontend-eng`](frontend-eng.md)         | Components, implementing designs, rendering bugs, page performance.      |
| Legal & Compliance         | [`legal-compliance`](legal-compliance.md) | Legal pages; privacy, accessibility, email and AI-disclosure compliance. |
| Media Manager              | [`media-mgr`](media-mgr.md)               | Photos, image optimization, galleries, the media library.                |
| Operations Lead            | [`ops-lead`](ops-lead.md)                 | Infrastructure, deployments, the server, operational coordination.       |
| Quality Assurance Reviewer | [`qa-reviewer`](qa-reviewer.md)           | Checking finished work for quality, consistency and correctness.         |
| SEO Specialist             | [`seo-specialist`](seo-specialist.md)     | Search, metadata, structured data, discoverability.                      |
| UI Designer                | [`ui-designer`](ui-designer.md)           | Visual polish: designs, visual bugs, brand consistency, effects.         |
| UX Designer                | [`ux-designer`](ux-designer.md)           | New pages, navigation, content hierarchy, usability problems.            |

How the roles are grouped into departments, who reviews whom and how much scrutiny a change gets is
in the [agent operating model](../process/agent-operating-model.md).

## Using a role from your tool

- **Claude Code** registers each role as a subagent in `.claude/agents/<role>.md`. Those files only
  hold Claude Code settings and point here.
- **Codex** and humans read the guide for the role they're working in
  ([Tool adapters](../../AGENTS.md#tool-adapters)).

## Sprint retrospective (every role)

### Practice

At the end of each sprint, the team holds a retrospective. Everyone working in a role takes part
by logging observations throughout the sprint.

### What to Track

During every work session, note anything that should be discussed at retro:

- **Issues encountered**: Bugs, broken workflows, tooling problems, unclear requirements
- **Friction points**: Tasks that took longer than expected and why
- **Feedback received**: Input from residents, neighbors, or Amine (project lead)
- **Architectural impacts**: Decisions or events that caused significant rework or pivots
- **Incomplete work**: Tasks left undone and the reason (blocked, deprioritized, out of scope)
- **Wins**: Things that went well, patterns worth repeating, tools that helped

### Where to Log

Append observations to the shared sprint retro file: `docs/memory/retro/sprint-{N}.md`

Entry format:

```markdown
### [Date] — [Role]

- **Observation**: What happened
- **Impact**: How it affected the work
- **Recommendation**: What to change or continue
```

### Cadence

- **Every session**: Log observations to the retro file before ending work
- **Weekly review**: Amine reviews the retro file at end of week
- **Biweekly retrospective**: Full team retro — review all observations, decide on changes, update processes
