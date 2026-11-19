/**
 * The shared hot spots (#695): places so many changes touch that two issues which each touch any
 * of them count as overlapping, even in different lines. The written rule is in
 * docs/process/project-management.md ("Shared hot spots"), one group here for each of its items;
 * `overlap-check.test.mjs` fails when the rule and this list drift apart, in both directions. This
 * file is the only place the checker reads them from. A path is a file or a folder; a folder covers
 * everything under it.
 *
 * - `rule`: a phrase that must appear in the written item this group implements.
 * - `prose`: paths the rule only describes in words (a layout, a header, a lockfile), so the
 *   rule does not name them as code; every other path must be named in the rule.
 */
export const HOT_SPOTS = [
  {
    name: 'shared platform and themes',
    rule: 'anything in',
    paths: ['src/platform', 'src/themes'],
  },
  {
    name: 'frontend layout, header, navigation and global styles',
    rule: 'the frontend layout, header, navigation and',
    paths: [
      'src/app/(frontend)/layout.tsx',
      'src/app/(frontend)/globals.css',
      'src/modules/site/ui/SiteHeader.tsx',
      'src/modules/site/ui/SiteHeaderBar.client.tsx',
      'src/modules/site/ui/HeaderNav.client.tsx',
      'src/modules/site/domain/nav.ts',
      'src/modules/site/cms/navGlobal.ts',
      'src/modules/site/data/globals.ts',
    ],
    prose: [
      'src/app/(frontend)/layout.tsx',
      'src/modules/site/ui/SiteHeader.tsx',
      'src/modules/site/ui/SiteHeaderBar.client.tsx',
      'src/modules/site/ui/HeaderNav.client.tsx',
      'src/modules/site/domain/nav.ts',
      'src/modules/site/cms/navGlobal.ts',
      'src/modules/site/data/globals.ts',
    ],
  },
  {
    name: 'CMS composition, generated types and migrations',
    rule: 'src/payload.config.ts',
    paths: ['src/payload.config.ts', 'src/payload-types.ts', 'src/migrations'],
  },
  {
    name: 'dependencies',
    rule: 'and the lockfile',
    paths: ['package.json', 'package-lock.json'],
    prose: ['package-lock.json'],
  },
  {
    name: 'process files',
    rule: 'the process files',
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
