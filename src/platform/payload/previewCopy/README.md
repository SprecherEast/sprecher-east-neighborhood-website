---
name: 'Preview copy'
type: feature
summary: 'what a preview copies.'
aliases: ['preview content']
relationships: []
---

# Preview copy

What a pull request's preview copies from the published site, so a preview looks like the real site without any private data. `classification.ts` is the only place that says so (#1395, #1077); the export and the import read it and none repeats it. Not content an editor writes: the allowlist is code, reviewed like code.

## How the pieces link

- **The allowlist:** every collection and global of the config, plugin ones included, is `copied`, `rebuilt` (search, built again from the copied documents) or `excluded`, with a one-line reason; one not listed is excluded, so a new one copies nothing until someone decides. A copied entry lists the top-level fields it keeps and clears, and whether it reads the `published` version only (every collection with drafts must) or `all`; never version tables.
- **Copied:** pages, posts, events, categories, team members (email cleared), resources, FAQ, media (only records copied documents point at), forms (recipients and templates cleared), header and footer. **Never copied:** accounts, passkeys and challenges, pending Google links, email confirmations, form submissions, agent keys, runs and review items, preferences, edit locks, jobs, the key-value store, migrations, redirects and media folders.
- **Two halves, split by who may read what** (#1396): the export runs from production's current release on a snapshot made by `ops/backup-db.mjs` (`e2e/previewCopyExport.ts`) and writes one private file, `PREVIEW_COPY_FILE`; the import runs from the pull request's own tree after its migrations (`e2e/previewCopyImport.ts`) and reads only that file. `ops/preview-copy.sh` runs both ([`ops/previews.md`](../../../../ops/previews.md#production-content-in-a-preview-1397), #1397).

## Behaviors and events

- **The export** reads through the Local API as an anonymous visitor (access checked, no user, published only, depth 0), cuts each document to its kept fields and follows references only to documents it copies; a reference to a draft, unpublished or uncopied document is removed, in fields, blocks and rich text (`exportContent.ts`, `references.ts`, `reshape.ts`). It lists the media file names and refuses a name that could leave the media folder.
- **The import** checks the file against the classification, writes documents with their ids through the adapter's `create` (so no hook runs: no email, cache refresh or search entry), fills references to later documents in a second pass, then rebuilds the search index through the search plugin's reindex (`importContent.ts`, `reindexSearch.ts`). A field the pull request's schema no longer has is skipped and counted.
- **Media addresses are made relative on import,** not export, so the file stays a faithful copy (`relativeMediaUrls.ts`, #1420). Both scripts keep Payload's logger silent and print only numbers and one fixed line on failure, because the deploy log is public.
- **To add a collection or global,** add its slug to `PREVIEW_COPY` with a reason, `excluded` unless a preview truly needs it; to copy it, mark every top-level field kept or cleared.

## Shared pieces it uses

- Payload's Local API and the search plugin's reindex; the config and its field types (`schema.ts`, `editorBlocks.ts`); `ops/backup-db.mjs` for the snapshot. Part of [Shared Payload code](../README.md).

## Rules and the tests that protect them

- **A kept field must be safe to publish:** an email field, a hidden field, a field a visitor may not read, or a link to a collection that is not copied must be cleared wherever it sits (groups, arrays, blocks, rich-text blocks and links). A copied collection must be readable by an anonymous visitor with no row filter but published (`classification.ts`; `classification.test.ts`, `testing/previewCopyGate.ts`).
- **The walk fails closed:** an unknown field type, editor feature, rich-text node, value shape, or a relationship that names no collection fails with a message and is never skipped (`schema.ts`; `classification.test.ts`).
- **A computed field on a kept collection needs a human look:** an `afterRead` hook's output is copied and the gate cannot see it (`posts.populatedAuthors` keeps only each name with a new id, so no account id reaches a preview) (`reshape.ts`).
- **A preview's own accounts are not copied;** they come from their own step (#1400, `src/endpoints/seed/preview-database.ts`).
- Export, import and file checks: `export.test.ts`, `import.test.ts`, `relativeMediaUrls.test.ts`, `references.test.ts`, `file.test.ts`, `run.test.ts`.

## Boundaries

- The export runs from production's release and the import from the pull request's tree; which tree runs which half is the ops step's to check, not the code's. Run the export with `NODE_ENV=production`, or the SQLite adapter pushes `main`'s schema onto the snapshot.

## Decisions

Issues #1077, #1395, #1396, #1397, #1400, #1420; the preview workflow is in [`ops/previews.md`](../../../../ops/previews.md).

## Known gaps

- Public addresses already printed in published text stay in the copied text; there is no scrub.
