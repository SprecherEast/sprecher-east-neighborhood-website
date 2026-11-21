/**
 * The other half of a preview's content copy (#1396, #1077): run by `payload run` from the pull
 * request's own tree, after its migrations, on the preview's fresh database. It reads only
 * `PREVIEW_COPY_FILE`, never the snapshot, writes the documents with their ids (no hooks, so no
 * email, cache refresh or search side effect), then rebuilds the search index through the plugin.
 * It prints numbers only, and one fixed line on a failure: the log is public.
 */
import config from '../src/payload.config'
import {
  copyFilePath,
  importFromFile,
  openQuietly,
  runPreviewCopyStep,
} from '../src/platform/payload/previewCopy/run'

const code = await runPreviewCopyStep('import', async () => {
  const path = copyFilePath()
  return importFromFile(await openQuietly(config), path)
})
process.exit(code)
