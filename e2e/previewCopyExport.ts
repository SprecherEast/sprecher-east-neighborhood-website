/**
 * The privileged half of a preview's content copy (#1396, #1077): run by `payload run` from
 * production's current release (`main`'s code), with `DATABASE_URI` pointing at a snapshot made by
 * ops/backup-db.mjs. It reads the snapshot as an anonymous visitor and writes the allowed published
 * content to `PREVIEW_COPY_FILE`, a new file private to its owner. It prints numbers only, and one
 * fixed line on a failure: the log is public. The pull request's own code never runs this.
 */
import config from '../src/payload.config'
import {
  copyFilePath,
  exportToFile,
  openQuietly,
  runPreviewCopyStep,
} from '../src/platform/payload/previewCopy/run'

const code = await runPreviewCopyStep('export', async () => {
  const path = copyFilePath()
  return exportToFile(await openQuietly(config), path)
})
process.exit(code)
