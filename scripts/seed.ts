/**
 * Seed script — imports data/events.json, posts.json, board.json into Payload CMS.
 * Run after first setup: npx payload run scripts/seed.ts
 */

import { getPayload, type RequiredDataFromCollectionSlug } from 'payload'
import config from '../src/payload.config'

// Convert plain text to Lexical richText JSON
function textToLexical(text: string) {
  const paragraphs = text.split('\n\n').filter(Boolean)
  return {
    root: {
      type: 'root',
      children: paragraphs.map((p) => ({
        type: 'paragraph',
        children: [
          {
            type: 'text',
            text: p.trim(),
            format: 0,
            detail: 0,
            mode: 'normal' as const,
            style: '',
            version: 1,
          },
        ],
        direction: 'ltr' as const,
        format: '' as const,
        indent: 0,
        version: 1,
      })),
      direction: 'ltr' as const,
      format: '' as const,
      indent: 0,
      version: 1,
    },
  }
}

// Map JSON categories to the slugs and titles of the category tree events share with posts (#362)
const eventCategoryMap: Record<string, { slug: string; title: string }> = {
  government: { slug: 'meeting', title: 'Meeting' },
  community: { slug: 'community', title: 'Community' },
  social: { slug: 'social', title: 'Social' },
  volunteer: { slug: 'volunteer', title: 'Volunteer' },
  workshop: { slug: 'workshop', title: 'Workshop' },
  sports: { slug: 'sports', title: 'Sports & Recreation' },
  other: { slug: 'other', title: 'Other' },
}

async function seed() {
  console.log('Seeding database...')
  const payload = await getPayload({ config })

  // ── Events ────────────────────────────────────────────────────────────────
  const eventsData = await import('../data/events.json')
  const rawEvents = eventsData.default as { events: any[] }
  const events = Array.isArray(rawEvents) ? rawEvents : (rawEvents.events ?? [])

  // The category with this slug, created the first time it's needed
  const categoryIds = new Map<string, number>()
  async function categoryIdFor(jsonCategory: string): Promise<number> {
    const { slug, title } = eventCategoryMap[jsonCategory] ?? eventCategoryMap.community
    const known = categoryIds.get(slug)
    if (known !== undefined) return known
    const { docs } = await payload.find({
      collection: 'categories',
      where: { slug: { equals: slug } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    const id =
      docs[0]?.id ??
      (
        await payload.create({
          collection: 'categories',
          data: { title, slug },
          overrideAccess: true,
        })
      ).id
    categoryIds.set(slug, id)
    return id
  }

  console.log(`  -> Seeding ${events.length} events...`)
  for (const e of events) {
    const slug = e.slug ?? e.title.toLowerCase().replace(/\s+/g, '-')
    try {
      await payload.create({
        collection: 'events',
        overrideAccess: true,
        data: {
          title: e.title,
          slug,
          date: e.date,
          timeStart: e.time_start ?? e.timeStart ?? undefined,
          timeEnd: e.time_end ?? e.timeEnd ?? undefined,
          categories: [await categoryIdFor(e.category)],
          locationType: e.location?.type ?? e.locationType ?? 'in-person',
          locationName: e.location?.name ?? e.locationName ?? undefined,
          locationAddress: e.location?.address ?? e.locationAddress ?? undefined,
          mapsUrl: e.location?.maps_url ?? e.mapsUrl ?? undefined,
          registrationUrl: e.registrationUrl ?? undefined,
          description: e.description,
          featured: e.featured ?? false,
          _status: 'published',
        },
      })
    } catch (err: any) {
      console.warn(`    ! Skipped event "${e.title}": ${err.message}`)
    }
  }

  // ── Posts ─────────────────────────────────────────────────────────────────
  const postsData = await import('../data/posts.json')
  const rawPosts = postsData.default as { posts: any[] }
  const posts = Array.isArray(rawPosts) ? rawPosts : (rawPosts.posts ?? [])

  console.log(`  -> Seeding ${posts.length} posts...`)
  for (const p of posts) {
    const slug = p.slug ?? p.title.toLowerCase().replace(/\s+/g, '-')
    try {
      await payload.create({
        collection: 'posts',
        overrideAccess: true,
        data: {
          title: p.title,
          slug,
          publishedAt: p.date ?? new Date().toISOString(),
          content: textToLexical(p.content ?? p.excerpt ?? ''),
          _status: 'published',
        },
      })
    } catch (err: any) {
      console.warn(`    ! Skipped post "${p.title}": ${err.message}`)
    }
  }

  // ── Team Members (Board) ──────────────────────────────────────────────────
  const boardData = await import('../data/board.json')
  const rawBoard = boardData.default as { board: any[] }
  const board = Array.isArray(rawBoard) ? rawBoard : (rawBoard.board ?? [])

  console.log(`  -> Seeding ${board.length} team members...`)
  for (let i = 0; i < board.length; i++) {
    const m = board[i]
    try {
      const member: RequiredDataFromCollectionSlug<'team-members'> = {
        memberType: 'board-member',
        name: m.name,
        role: m.role,
        bio: m.bio ?? undefined,
        email: m.email || undefined,
        status: 'active',
        order: i + 1,
      }
      await payload.create({ collection: 'team-members', overrideAccess: true, data: member })
    } catch (err: any) {
      console.warn(`    ! Skipped member "${m.name}": ${err.message}`)
    }
  }

  console.log('Seed complete.')
  process.exit(0)
}

seed().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
