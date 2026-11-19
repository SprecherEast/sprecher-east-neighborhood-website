import { sqliteAdapter } from '@payloadcms/db-sqlite'
import { formBuilderPlugin } from '@payloadcms/plugin-form-builder'
import { mcpPlugin } from '@payloadcms/plugin-mcp'
import { nestedDocsPlugin } from '@payloadcms/plugin-nested-docs'
import { redirectsPlugin } from '@payloadcms/plugin-redirects'
import { searchPlugin } from '@payloadcms/plugin-search'
import { seoPlugin } from '@payloadcms/plugin-seo'
import type { GenerateTitle, GenerateURL } from '@payloadcms/plugin-seo/types'
import sharp from 'sharp'
import path from 'path'
import { buildConfig, type Plugin } from 'payload'
import { fileURLToPath } from 'url'

import type { Event, Page, Post } from '@/payload-types'
import { keepAccountEmails, noVerifyMutation, Users } from '@/modules/accounts/cms'
import { AgentReviewItems, AgentRuns, mcpOptions } from '@/modules/agents/cms'
import {
  contactRetentionTask,
  createFormBuilderOptions,
  FormBlock,
  keepSendersWithMessages,
  markSubmissionsConfirmed,
} from '@/modules/contact/cms'
import { FAQ, Resources, TeamMembers } from '@/modules/directory/cms'
import { Events, EventsThisWeekBlock } from '@/modules/events/cms'
import { Categories, Posts, searchOptions, TopIssuesBlock } from '@/modules/news/cms'
import {
  createPagesCollection,
  Footer,
  Header,
  revalidateRedirects,
  SITE_LAYOUT_BLOCKS,
} from '@/modules/site/cms'
import {
  createConfirmationRetentionTask,
  createEmailConfirmations,
  emailConfirmer,
} from '@/modules/verification/cms'
import { Media } from '@/platform/payload/media'
import { defaultLexical } from '@/platform/payload/defaultLexical'
import {
  isAdmin,
  isAdminBoolean,
  isAdminOrEditor,
  isAdminOrEditorBoolean,
} from '@/platform/payload/roles'
import { getServerSideURL } from '@/platform/lib/getURL'
import { emailAdapterFromEnv } from '@/platform/email/emailAdapter'
import { restrictEditLocks } from '@/platform/payload/restrictEditLocks'
import { restrictJobStats } from '@/platform/payload/restrictJobStats'
import { ADMIN_FORGOT_ROUTE, ADMIN_ROUTE } from '@/platform/payload/adminRoutes'
import { JOB_RUNNERS } from '@/platform/payload/jobRunners'

// Modules meet here (0008): contact's form, events' "this week" strip (#122) and news's top
// issues (#484) join site's blocks
const Pages = createPagesCollection({
  layoutBlocks: [...SITE_LAYOUT_BLOCKS, FormBlock, EventsThisWeekBlock, TopIssuesBlock],
})
// Email confirmation by link (#183): once an address is confirmed, its contact messages are too
const EmailConfirmations = createEmailConfirmations({ onConfirmed: [markSubmissionsConfirmed] })
// Retention (#274): a confirmed address stays while a message from it is kept, or an account
// uses it
const confirmationRetentionTask = createConfirmationRetentionTask({
  keepers: [keepSendersWithMessages, keepAccountEmails],
})

const generateTitle: GenerateTitle<Post | Page | Event> = ({ doc }) => {
  return doc?.title || 'Sprecher East'
}

const generateURL: GenerateURL<Post | Page | Event> = ({ doc, collectionConfig }) => {
  const url = getServerSideURL()

  if (!doc?.slug) return url

  if (collectionConfig?.slug === 'events') {
    return `${url}/events/${doc.slug}`
  }

  if (collectionConfig?.slug === 'posts') {
    return `${url}/posts/${doc.slug}`
  }

  return `${url}/${doc.slug}`
}

// Plugins are composed here too: several modules each bring their own options (0008)
const plugins: Plugin[] = [
  redirectsPlugin({
    collections: ['pages', 'posts'],
    overrides: {
      access: {
        create: isAdmin,
        read: isAdmin,
        update: isAdmin,
        delete: isAdmin,
      },
      // @ts-expect-error - This is a valid override, mapped fields don't resolve to the same type
      fields: ({ defaultFields }) => {
        return defaultFields.map((field) => {
          if ('name' in field && field.name === 'from') {
            return {
              ...field,
              admin: {
                description: 'You will need to rebuild the website when changing this field.',
              },
            }
          }
          return field
        })
      },
      hooks: {
        afterChange: [revalidateRedirects],
      },
    },
  }),
  nestedDocsPlugin({
    collections: ['categories'],
    generateURL: (docs) => docs.reduce((url, doc) => `${url}/${doc.slug}`, ''),
  }),
  // No `collections`: Pages, Posts and Events build their own SEO tab (with an image) from the
  // plugin's fields. Listing them here added a second `meta` group without one, which reads
  // returned, so no share image or card thumbnail ever showed (#196).
  seoPlugin({
    generateTitle,
    generateURL,
  }),
  // Forms, submissions and their safeguards belong to the contact module; the sender's address
  // is confirmed through the verification module's confirmer (#183)
  formBuilderPlugin(createFormBuilderOptions({ emailConfirmer })),
  // Search belongs to news; it also indexes events, which the module doesn't name (0008)
  searchPlugin({ ...searchOptions, collections: ['posts', 'events'] }),
  // Agents find content and suggest drafts at /api/mcp, as agent accounts (#336)
  mcpPlugin(mcpOptions),
]

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

// Edit locks get staff-only access after Payload has added them (#147), and the job stats
// admin-only (#274)
export default buildConfig({
  // Payload's defaults, from one place: the proxy redirects the forgot-password page (#282)
  routes: { admin: ADMIN_ROUTE },
  admin: {
    routes: { forgot: ADMIN_FORGOT_ROUTE },
    components: {
      beforeLogin: ['@/platform/payload/admin/BeforeLogin'],
      beforeDashboard: ['@/platform/payload/admin/BeforeDashboard'],
    },
    importMap: {
      baseDir: path.resolve(dirname),
    },
    user: Users.slug,
    livePreview: {
      breakpoints: [
        {
          label: 'Mobile',
          name: 'mobile',
          width: 375,
          height: 667,
        },
        {
          label: 'Tablet',
          name: 'tablet',
          width: 768,
          height: 1024,
        },
        {
          label: 'Desktop',
          name: 'desktop',
          width: 1440,
          height: 900,
        },
      ],
    },
  },
  editor: defaultLexical,
  db: sqliteAdapter({
    client: {
      url: process.env.DATABASE_URI ?? 'file:./data/payload.db',
    },
  }),
  collections: [
    Pages,
    Posts,
    Events,
    TeamMembers,
    Resources,
    FAQ,
    Media,
    Categories,
    Users,
    EmailConfirmations,
    AgentRuns,
    AgentReviewItems,
  ],
  cors: [getServerSideURL()].filter(Boolean),
  globals: [Header, Footer],
  folders: {
    // Media folders are staff-only: Payload's default would let any signed-in account create,
    // rename or delete them through the API (#140).
    collectionOverrides: [
      ({ collection }) => ({
        ...collection,
        access: {
          ...collection.access,
          read: isAdminOrEditor,
          readVersions: isAdminOrEditor,
          create: isAdminOrEditor,
          update: isAdminOrEditor,
          delete: isAdminOrEditor,
        },
      }),
    ],
  },
  // SMTP (Mailgun in production); unset → emails go to the server log
  email: emailAdapterFromEnv(),
  jobs: {
    // Payload's default lets any signed-in account run, queue or cancel jobs (#140). Editors
    // queue and cancel scheduled publishes from Admin; only admins may run the queue by hand.
    access: { cancel: isAdminOrEditorBoolean, queue: isAdminOrEditorBoolean, run: isAdminBoolean },
    // The owner's retention rules (#274), scheduled every hour
    tasks: [contactRetentionTask, confirmationRetentionTask],
    // Runs the retention queue (#274) and scheduled publishing (#141) inside the app's one PM2
    // process: no separate worker
    autoRun: JOB_RUNNERS,
  },
  // Absolute links in emails (password reset). Without it Payload derives the origin from the
  // request and, behind the Caddy proxy (http upstream vs https allowlist), falls back to a
  // relative link that doesn't work in an email.
  serverURL: getServerSideURL(),
  plugins,
  secret: process.env.PAYLOAD_SECRET,
  sharp,
  graphQL: {
    // Accounts are verified only from the site's page, after the robot check (#303)
    validationRules: () => [noVerifyMutation],
  },
  typescript: {
    // Regenerate types only under `next dev`. Payload otherwise rewrites this file whenever
    // NODE_ENV isn't 'production' — including `payload migrate` in the deploy — which left the
    // server checkout dirty and can make the next deploy's `git pull` fail (#115).
    // After schema changes, run `npm run generate:types`.
    autoGenerate: process.env.NODE_ENV === 'development',
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
})
  .then(restrictEditLocks)
  .then(restrictJobStats)
