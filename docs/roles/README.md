# Roles

Role guides describe a focus area of the work on this site: its mission, what good looks like, and
its checklists. Any agent, or any human, can take on a role by reading its guide; nothing here
depends on a particular tool or model.

[`AGENTS.md`](../../AGENTS.md), the [guidelines](../guidelines/README.md) and
[`docs/architecture/`](../architecture/README.md) win wherever a role guide disagrees with them. If
you find a disagreement, fix the role guide in the same PR.

Role guides are policy files: the review calls out a change to one, and a change the owner didn't
ask for waits for him ([`change-workflow`](../../.agents/skills/change-workflow/SKILL.md#the-path-to-main), step 3).

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
| Worker                     | [`worker`](worker.md)                     | Finishing one Ready issue, from claim to merge.                          |

How the agent team uses the guides, who reviews whom and how much scrutiny a change gets is in the
[agent operating model](../process/agent-operating-model.md).

## How a role guide is loaded

A role is a guide, not an agent. The only agents are the chief of staff, the worker, the reviewer
(`qa-reviewer`, which works from its own guide) and the outsider reviewer (which works from its skill). A guide loads by name from this folder:
`docs/roles/<name>.md`, where `<name>` is the one in the table. The dispatch brief names the guides
a task needs, because an agent skips instructions it has to choose to open
([operating model](../process/agent-operating-model.md#3-skills-not-agents)), and the worker reads
them before it starts. Claude Code, Codex and humans all read the same file; there is no copy in
`.claude/`. Where a guide says to work with another role, it means the checks of that role's guide,
not another agent.

## Weekly review (every role)

The team improves through the [weekly review](../process/weekly-review.md), which the chief of
staff runs from GitHub. So that it has something to read, note friction on the issue you work on,
in its `### [STEP]` comments: what failed or came back, what took longer than it should, where the
owner had to step in, and what you would automate. Do not keep notes in loose files; a note that
is not on GitHub is not seen.
