'use client'

import { ChevronDown } from 'lucide-react'
import React from 'react'

import { cn } from '@/platform/lib/cn'

import { Link } from './Link'

import { currentSectionId, hasOnThisPage, readingLine, type OnThisPageSection } from './onThisPage'

export type OnThisPageProps = {
  sections: OnThisPageSection[]
  className?: string
}

/** The id of the section being read: the last heading at or above the reading line */
function useCurrentSection(ids: string[]): string | null {
  const [current, setCurrent] = React.useState<string | null>(null)
  const key = ids.join('\n')

  React.useEffect(() => {
    const ids = key.split('\n')
    let frame = 0
    const update = () => {
      frame = 0
      // Looked up on every update: a live preview can replace a heading's element (h2 to h3)
      // while keeping its id, and a saved element would then be detached
      const elements = ids.flatMap((id) => {
        const element = document.getElementById(id)
        return element ? [element] : []
      })
      if (elements.length === 0) return
      // The line is where a jump lands (the heading's own scroll margin, set from
      // `--anchor-offset`), so the section a click jumps to is the one highlighted
      const line = readingLine(getComputedStyle(elements[0]).scrollMarginTop)
      const tops = elements.map((element) => ({
        id: element.id,
        top: element.getBoundingClientRect().top,
      }))
      setCurrent(currentSectionId(tops, line))
    }
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [key])

  return current
}

function SectionList({
  sections,
  current,
  onChoose,
}: {
  sections: OnThisPageSection[]
  current: string | null
  onChoose?: () => void
}) {
  return (
    <ol className="space-y-1">
      {sections.map((section) => (
        <li key={section.id}>
          <Link
            href={`#${section.id}`}
            variant="section"
            current={section.id === current ? 'location' : false}
            onClick={onChoose}
            className={cn(section.level === 3 && 'pl-6')}
          >
            {section.text}
          </Link>
        </li>
      ))}
    </ol>
  )
}

/**
 * The article's sections as a menu (#574): a sticky rail from `lg`, a bar under the site header
 * before that. Jumps are plain `#id` links, so they work without JavaScript; only the highlight of
 * the section being read needs it. Shows nothing for an article with fewer than three sections.
 * Place it where `DetailLayout` takes its `toc`.
 */
export function OnThisPage({ sections, className }: OnThisPageProps) {
  const current = useCurrentSection(sections.map((section) => section.id))
  const detailsRef = React.useRef<HTMLDetailsElement>(null)
  if (!hasOnThisPage(sections)) return null

  const currentText = sections.find((section) => section.id === current)?.text

  return (
    <nav
      aria-label="On this page"
      className={cn(
        // Phones and tablets: a bar that sticks under the site header. From lg: a rail beside the article
        'sticky top-[var(--header-height)] z-30 -mx-4 mb-6 border-y border-border bg-background md:-mx-8 noscript:static',
        'lg:top-[var(--anchor-offset)] lg:-mx-1 lg:mb-0 lg:max-h-[calc(100svh-var(--anchor-offset)-1rem)] lg:overflow-y-auto lg:border-0 lg:bg-transparent lg:px-1 lg:py-1',
        className,
      )}
    >
      <details ref={detailsRef} className="group lg:hidden">
        <summary className="flex min-h-[var(--section-bar-height)] cursor-pointer list-none items-center justify-between gap-3 px-4 text-sm font-semibold text-foreground focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring md:px-8 [&::-webkit-details-marker]:hidden">
          <span className="min-w-0 truncate">
            On this page
            {currentText && (
              <span className="font-normal text-muted-foreground"> · {currentText}</span>
            )}
          </span>
          <ChevronDown
            aria-hidden="true"
            className="size-5 shrink-0 transition-transform duration-200 group-open:rotate-180"
          />
        </summary>
        <div className="max-h-[60svh] overflow-y-auto border-t border-border px-2 py-2 md:px-6">
          <SectionList
            sections={sections}
            current={current}
            onChoose={() => detailsRef.current?.removeAttribute('open')}
          />
        </div>
      </details>

      <div className="hidden lg:block">
        <p className="mb-2 px-3 text-xs font-bold tracking-widest text-primary-strong uppercase">
          On this page
        </p>
        <SectionList sections={sections} current={current} />
      </div>
    </nav>
  )
}
