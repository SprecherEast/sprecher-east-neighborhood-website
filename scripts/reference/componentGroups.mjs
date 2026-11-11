/**
 * How the shared components are grouped into pages under docs/reference/components/ (#718). This is
 * the one thing about the components that code cannot say, so it is written here. The generator
 * fails when an exported component is in no group, or a group names one that no longer exists, so
 * a new component can't be added without choosing its page.
 */
export const COMPONENT_GROUPS = [
  {
    slug: 'actions',
    title: 'Actions',
    intro:
      'Buttons and links. `Button` is the only thing that draws a button; `Link` only ever looks like text.',
    components: ['Button', 'Link', 'AppLink', 'LinkButton'],
  },
  {
    slug: 'form-fields',
    title: 'Form fields',
    intro: 'A `Form` holds `Field`s; a `Field` holds exactly one control.',
    components: ['Form', 'Field', 'FieldInput', 'FieldTextArea', 'FieldSelect', 'FieldCheckbox'],
  },
  {
    slug: 'cards',
    title: 'Cards',
    intro: 'The one card, its parts, and the grid that lays cards out.',
    components: [
      'Card',
      'CardMedia',
      'CardBody',
      'CardTitle',
      'CardMeta',
      'CardFooter',
      'CardGrid',
      'CardGridItem',
    ],
  },
  {
    slug: 'display',
    title: 'Display',
    intro: 'Badges, text, dates and the other parts that show content.',
    components: [
      'Badge',
      'BadgeList',
      'CancelledBadge',
      'CertaintyBadge',
      'ProgressBar',
      'DateTime',
      'MetaList',
      'Text',
      'Caption',
      'Legend',
      'ImageCredit',
      'FeaturedImage',
    ],
  },
  {
    slug: 'sections',
    title: 'Sections and page headers',
    intro:
      'Larger parts of a page: the page header, empty states, the sidebar call to action, and the expanding rows and tabs.',
    components: ['PageHeader', 'EmptyState', 'SidebarCTA', 'Disclosure', 'Tabs'],
  },
  {
    slug: 'media',
    title: 'Media',
    intro: 'Images and video. `Media` picks the right one for an uploaded file.',
    components: ['Media', 'ImageMedia', 'VideoMedia', 'MapEmbed', 'Figure'],
  },
  {
    slug: 'feedback',
    title: 'Feedback and overlays',
    intro: 'Messages, toasts and dialogs.',
    components: ['Alert', 'Dismissible', 'Toast', 'Dialog', 'RouteDialog', 'Zoom'],
  },
  {
    slug: 'navigation',
    title: 'Navigation and page tools',
    intro: 'Breadcrumbs, the table of contents, paging and the helpers that run beside a page.',
    components: [
      'Breadcrumbs',
      'OnThisPage',
      'LoadMoreFooter',
      'AdminBar',
      'LivePreviewListener',
      'VersionCheck',
    ],
  },
  {
    slug: 'layout',
    title: 'Layout and page structure',
    intro: 'The frames a page is built in, and the structured data it carries.',
    components: ['Section', 'PageBackdrop', 'ArticlePage', 'DetailLayout', 'JsonLd'],
  },
  {
    slug: 'charts',
    title: 'Charts',
    intro: 'The chart component and the drawing parts behind its adapters.',
    components: [
      'Chart',
      'ChartDataTable',
      'ChartZoom',
      'SquareGrid',
      'TileGrid',
      'BreakdownChart',
      'BarChartSvg',
      'BarSegment',
      'ShareBar',
      'ShareBarSwatch',
      'AmountBar',
      'ScaledBreakdown',
      'ChartCaption',
    ],
  },
  {
    slug: 'rich-text',
    title: 'Rich text',
    intro:
      'The renderer for rich text and the blocks that sit inside it (`src/platform/richtext/`).',
    components: [
      'RichText',
      'BannerBlock',
      'MediaBlock',
      'Code',
      'CodeBlock',
      'CopyButton',
      'Steps',
      'Timeline',
      'OutcomeFork',
      'DiagramKey',
      'FigureBlock',
    ],
  },
  {
    slug: 'key-facts',
    title: 'Key facts and fact tabs',
    intro:
      'Key facts as cards, and the fact tabs that open charts, timelines and the whole tax bill (`src/platform/richtext/editorial/`).',
    components: ['KeyFacts', 'FactCard', 'FactTabs', 'BillShare'],
  },
]
