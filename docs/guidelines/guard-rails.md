# Guard rails: non-negotiable

These rules apply to every change, by every agent and every human. They are not preferences and
they cannot be traded for speed. Summary of the owner's direction (2026-11-03, Claude Code session, text, recorded on #609 and in PR
#612): shortcuts, duplicated code, raw tags and the like are not allowed, and neither is bypassing or
skipping these rules. They are hard rules and non-negotiable. Above all, build each thing once and
reuse it everywhere. Keep simplifying and reviewing, and stay within domain-driven design, clean
architecture, test-driven development and similar bounds.

## The rules

1. **Build once, reuse everywhere.** Search before writing
   ([DRY order](development.md#dry--dont-repeat-yourself)). The second time a piece of logic,
   markup, class string, constant or layout number appears, it becomes one shared thing that both
   places use, in the same PR. Never copy and adjust. A number that two files must agree on (a
   header height, a scroll offset, a limit) has one definition: a theme token, a CSS variable or an
   exported constant.
2. **The UI kit, not raw tags.** Anything the kit covers goes through it: `Link` for links (also
   `#` links), `Button`, `Field`, `Card`, `Media`, `Text`, `Section`, and `lucide-react` for icons.
   No raw `<a>`, `<button>`, `<input>`, `<select>`, `<textarea>`, `<img>` or inline SVG in feature
   code. A native element the kit lacks (`<details>`) lives inside a kit component, never in a
   page or module. A missing variant is added to the kit component, not worked around, unless it
   would bloat it: then it's a new shared component
   ([use, configure or split](components-and-content.md#shared-components-use-configure-or-split)).
3. **Theme isolation.** Colour, radius, shadow, type and spacing come from theme tokens
   ([`nextjs-tailwind.md`](nextjs-tailwind.md)). No literals or raw palette classes outside the
   theme, and both light and dark checked.
4. **Domain-driven, clean architecture.** Code lives in its module and layer
   ([`docs/architecture/`](../architecture/README.md)): rules in `domain/`, orchestration in
   `use-cases/`, Payload only where the architecture allows it (`data/`, `cms/`, `platform/`, `payload.config.ts`), plain props from mappers into `ui/`,
   dependencies pointing inward, no module importing another. Shared code goes to `platform/`.
5. **Test first.** A rule, guard, mapper, hook or component behaviour starts as a failing test,
   then the code ([`write-code`](../../.agents/skills/write-code/SKILL.md) §4). A bug fix starts
   with the test that reproduces it. A new shared component comes with its test, an axe check, its
   gallery entry and its row in `docs/ui/component-set.md`.
6. **Self-review before every PR.** Run the [`self-review`](../../.agents/skills/self-review/SKILL.md)
   skill on the final diff, and again after any later push. Record it in the PR's
   **Self-review** section: for reuse, quality, efficiency, guidelines and visual design, what was
   checked and what was fixed (write "not applicable, because …" where it truly is not). `PR Policy` fails an empty section or
   an item with under 10 characters, but it can't judge whether the text is true: the reviewer does
   (rule 7).
7. **Violations are Blockers.** A reviewer treats any breach of rules 1–6 and 9 as a **Blocker**: never
   "Minor", never "accepted", never a follow-up issue. The author fixes it in the PR. The review
   checks the Self-review section against the diff, and a section that claims what the diff
   doesn't show is itself a Blocker.
8. **Nobody can waive them.** "Keep going", "don't stop", "merge without waiting", a deadline or a
   long session never permit skipping a rule or a step: they mean don't wait for the owner, not
   don't follow the process. If a rule seems to block the task, stop, say which rule and why, and
   ask. A breach found after merge is fixed first, in its own PR, before other work.
9. **Documentation follows behavior.** A change in what a visitor, an editor or an agent gets
   changes the note that describes it (`docs/knowledge/map.json`), or the generated reference, in
   the same PR (owner, 2026-11-06, #712; [0019](../architecture/decisions/0019-knowledge-layer.md) §6).

## What enforces them

| Rule                  | Enforced by                                                                                                                                                                    |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Theme (3)             | ESLint (`eslint.theme.config.mjs`), the theme contract test                                                                                                                    |
| Raw tags (2)          | ESLint ban on raw `a`, `button`, `input`, `select`, `textarea`, `details`, `summary` and `img` outside the kit (#465, #609, #610)                                              |
| Architecture (4)      | ESLint boundaries (`eslint.boundaries.config.mjs`); knip reports unused code (not a required check yet)                                                                        |
| Duplication (1)       | `Duplicate code (jscpd)` fails a repeated block of 12+ lines (#611, #622; not a required check yet), then review for what a tool can't see: the same logic written differently |
| Documentation (9)     | `PR Policy` and `Knowledge sync` in CI; the reviewer lists every behavior change and finds its sentence                                                                        |
| Self-review (6)       | `PR Policy` requires the Self-review section, then the reviewer checks it                                                                                                      |
| Tests (5), violations | Required CI (tests, axe), then the reviewer. These two rest on the reviewer's diligence                                                                                        |

Checks catch what a machine can. The rest depends on the author doing the work and the reviewer
looking at the diff, which is why a breach is a Blocker and cannot be waived.
