// Redirects the site sends before any page renders (next.config.js uses them). Redirects editors
// set in the CMS are separate; they live in the `redirects` collection.
const redirects = async () => {
  /** @type {import('next').Redirect[]} */
  const redirects = [
    // The single Resources page became one page per group (#1245); old links and search results
    // go to the first group. This is the address of RESOURCE_GROUPS[0], which a test checks.
    { source: '/resources', destination: '/resources/utilities', permanent: true },
  ]

  return redirects
}

export default redirects
