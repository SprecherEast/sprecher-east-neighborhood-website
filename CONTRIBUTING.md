# Contributing

Thanks for helping with the Sprecher East website. Every change follows the same workflow,
whether a person or an AI agent makes it. The full rules are in [`AGENTS.md`](AGENTS.md).
In short:

1. **Open an issue** with one of the issue forms. It describes the problem and gets type,
   area, and priority labels.
2. **Open a pull request** from a branch. It links the issue (`Closes #123`) and fills in the
   template: what changed, why, how, how to test, and risk & rollback.
3. **Get it reviewed.** An independent reviewer posts a review that ends with "Ready to merge".
4. **All checks green.** Type-check & Build, Prettier, ESLint, Dependency Audit, PR Policy, Knowledge sync, Agent context.
5. **Merge** (squash, with every rule enforced). GitHub Actions then deploys `main` to production.

Nobody changes code directly on the server. Step-by-step instructions are in
[`.agents/skills/change-workflow/SKILL.md`](.agents/skills/change-workflow/SKILL.md).
