import { Check, Circle } from 'lucide-react'
import Markdown from 'markdown-to-jsx/react'
import React, { type ComponentProps } from 'react'

import { Link } from '@/platform/ui/Link'
import { Text } from '@/platform/ui/Text'

/*
 * An issue's description, which is Markdown anyone may have typed. It is drawn safely: raw HTML
 * shows as plain text, only web links become links, and no image loads. Every element is the kit's
 * or a prose element styled by the same classes as article text.
 */
const WEB_ADDRESS = /^https?:\/\//i

function SafeLink({ href, children }: ComponentProps<'a'>) {
  if (!href || !WEB_ADDRESS.test(href)) return <span>{children}</span>
  return (
    <Link href={href} external>
      {children}
    </Link>
  )
}

/** An image is never loaded: the reader gets its description */
function AltText({ alt }: ComponentProps<'img'>) {
  return alt ? <span>{alt}</span> : null
}

/** A task list box, in words and an icon, so it isn't a form control or just a colour */
function TaskBox({ checked }: ComponentProps<'input'>) {
  return (
    <>
      {checked ? (
        <Check aria-hidden="true" className="mr-1 inline size-4 align-text-bottom" />
      ) : (
        <Circle aria-hidden="true" className="mr-1 inline size-4 align-text-bottom" />
      )}
      <span className="sr-only">{checked ? 'Done:' : 'Not done:'}</span>
    </>
  )
}

/** The issue's own headings sit under the page's: never an h1 */
const heading = (as: 'h3' | 'h4') =>
  function Heading({ children }: ComponentProps<'h2'>) {
    return (
      <Text variant="subsection" as={as}>
        {children}
      </Text>
    )
  }

const OVERRIDES = {
  a: SafeLink,
  img: AltText,
  input: TaskBox,
  h1: heading('h3'),
  h2: heading('h3'),
  h3: heading('h4'),
  h4: heading('h4'),
  h5: heading('h4'),
  h6: heading('h4'),
}

export function IssueMarkdown({ children }: { children: string }) {
  return (
    <div className="prose max-w-none [overflow-wrap:anywhere] prose-headings:text-balance">
      <Markdown options={{ disableParsingRawHTML: true, overrides: OVERRIDES }}>
        {children}
      </Markdown>
    </div>
  )
}
