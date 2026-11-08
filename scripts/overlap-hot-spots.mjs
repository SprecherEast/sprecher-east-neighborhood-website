/**
 * The shared hot spots (#695): places so many changes touch that two issues which each touch the
 * same group count as overlapping, even in different lines. The written rule is in
 * docs/process/project-management.md ("Shared hot spots"); `overlap-check.test.mjs` fails when a
 * path named there is missing here. This file is the only place the checker reads them from.
 * A path is a file or a folder; a folder covers everything under it.
 */
export const HOT_SPOTS = [
  { name: 'shared platform and themes', paths: ['src/platform', 'src/themes'] },
  {
    name: 'frontend layout, header, navigation and global styles',
    paths: [
      'src/app/(frontend)/layout.tsx',
      'src/app/(frontend)/globals.css',
      'src/modules/site/ui/SiteHeader.tsx',
      'src/modules/site/ui/SiteHeaderBar.client.tsx',
      'src/modules/site/ui/HeaderNav.client.tsx',
      'src/modules/site/domain/nav.ts',
    ],
  },
  {
    name: 'CMS composition, generated types and migrations',
    paths: ['src/payload.config.ts', 'src/payload-types.ts', 'src/migrations'],
  },
  { name: 'dependencies', paths: ['package.json', 'package-lock.json'] },
  {
    name: 'process files',
    paths: [
      'AGENTS.md',
      'CLAUDE.md',
      '.agents',
      '.claude',
      '.github',
      'docs/guidelines',
      'docs/roles',
      'docs/process',
    ],
  },
]
