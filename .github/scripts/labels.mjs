/**
 * The two label calls the issue workflows share (`Issue Labels` and `Issue Policy`): create a
 * label that may already exist, and remove one that may not be there. `github` is the
 * github-script client.
 */

/** Creates `label` ({ name, color, description }); a label that already exists (422) is fine. */
export async function ensureLabel(github, { owner, repo }, label) {
  try {
    await github.rest.issues.createLabel({ owner, repo, ...label })
  } catch (error) {
    if (error.status !== 422) throw error
  }
}

/** Removes the label from the issue; one that is not on it (404) is fine. */
export async function dropLabel(github, { owner, repo, issue_number }, name) {
  try {
    await github.rest.issues.removeLabel({ owner, repo, issue_number, name })
  } catch (error) {
    if (error.status !== 404) throw error
  }
}
