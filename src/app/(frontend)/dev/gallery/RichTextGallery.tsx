import React from 'react'

import { CodeBlock } from '@/platform/richtext/CodeBlock'
import { KeyFacts } from '@/platform/richtext/editorial/KeyFacts'
import { RichText } from '@/platform/richtext/RichText'
import { richTextBlocks } from '@/platform/richtext/richTextBlocks'
import { READING_WIDTH } from '@/platform/ui/layoutSizes'

import { SAMPLE_BLOCKS_POST } from './blocksPostSample'
import { GalleryEntry, GalleryVariant } from './GalleryEntry'
import { SAMPLE_CODE, SAMPLE_KEY_FACTS, SAMPLE_RICH_TEXT } from './sampleData'

/** The rich-text renderer and the code block inside it */
export function RichTextGallery() {
  return (
    <>
      <GalleryEntry name="RichText" description="Lexical content as the editor saved it.">
        <GalleryVariant label="prose (the default)" className="block">
          <RichText data={SAMPLE_RICH_TEXT} enableGutter={false} />
        </GalleryVariant>
        <GalleryVariant label="without prose" className="block">
          <RichText data={SAMPLE_RICH_TEXT} enableGutter={false} enableProse={false} />
        </GalleryVariant>
      </GalleryEntry>

      <GalleryEntry
        name="RichTextBlocks"
        description="A post body with the visual blocks in a row and a chart of each kind between them, rendered as a post page does."
      >
        <GalleryVariant
          label="key facts, charts, timeline, steps and an outcome fork"
          className="block"
        >
          <RichText
            className={READING_WIDTH}
            data={SAMPLE_BLOCKS_POST}
            blocks={richTextBlocks}
            enableGutter={false}
          />
        </GalleryVariant>
      </GalleryEntry>

      <GalleryEntry
        name="CodeBlock"
        description="A code block inside rich text, with a copy button."
      >
        <GalleryVariant label="one look" className="block">
          <CodeBlock blockType="code" code={SAMPLE_CODE} language="ts" />
        </GalleryVariant>
      </GalleryEntry>

      <GalleryEntry
        name="KeyFacts"
        description="A row of fact cards inside rich text: icon and bold subject on one line, the big value, an optional explanation, then how sure we are and the source."
      >
        <GalleryVariant label="three facts" className="block">
          <KeyFacts facts={SAMPLE_KEY_FACTS} />
        </GalleryVariant>
        <GalleryVariant
          label="two facts, the longest label (60 characters) and explanation (90)"
          className="block"
        >
          <KeyFacts facts={SAMPLE_KEY_FACTS.slice(1)} />
        </GalleryVariant>
      </GalleryEntry>
    </>
  )
}
