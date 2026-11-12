import React from 'react'

import { CodeBlock } from '@/platform/richtext/CodeBlock'
import { FactTabs } from '@/platform/richtext/editorial/FactTabs'
import { toFactTabsProps } from '@/platform/richtext/editorial/factTabs'
import { FACT_TABS_FIXTURE } from '@/platform/richtext/editorial/factTabsFixtures'
import { KeyFacts } from '@/platform/richtext/editorial/KeyFacts'
import { RichText } from '@/platform/richtext/RichText'
import { richTextBlocks } from '@/platform/richtext/richTextBlocks'
import { READING_WIDTH } from '@/platform/ui/layoutSizes'

import { SAMPLE_BLOCKS_POST } from './blocksPostSample'
import { GalleryEntry, GalleryVariant } from './GalleryEntry'
import { SAMPLE_CODE, SAMPLE_KEY_FACTS, SAMPLE_RICH_TEXT, UNEVEN_KEY_FACTS } from './sampleData'

const FACT_TABS = toFactTabsProps(FACT_TABS_FIXTURE)
/** The first tab with a whole tax bill at the top of its panel (sample rates, not the City's) */
const BILL_TAB = {
  ...(FACT_TABS.tabs[0] as (typeof FACT_TABS.tabs)[number]),
  // The button and heading follow the home and year in the bill (#1029)
  fact: {
    ...(FACT_TABS.tabs[0] as (typeof FACT_TABS.tabs)[number]).fact,
    value: '+{yearly} a year',
  },
  heading: 'Your share: {monthly} a month',
  panel: [
    {
      kind: 'billShare' as const,
      billShare: {
        intro: 'Sample: based on an average home. Change the value to see yours.',
        years: [
          {
            year: 2026,
            label: '2026 rates',
            note: '',
            averageHome: 481300,
            rates: { schools: 8.6814, county: 2.3564, matc: 0.6153, city: 7.0139 },
            source: {
              label: 'Sample: City tax detail',
              href: 'https://example.org/tax',
              external: true,
              appearance: 'default' as const,
            },
          },
          {
            year: 2027,
            label: '2027 rates',
            note: 'proposed',
            averageHome: 500300,
            rates: { city: 6.93 },
            source: null,
          },
        ],
      },
    },
    {
      kind: 'chart' as const,
      enlarge: false,
      spec: {
        kind: 'stacked' as const,
        title: 'Sample: City tax on an average home',
        summary: 'Sample figures.',
        unit: 'usd' as const,
        orientation: 'horizontal' as const,
        x: ['2026 adopted', '2027 proposed'],
        series: [
          { key: 'same', label: 'Same as 2026', values: [3375.89, 3375.89] },
          {
            key: 'more',
            label: 'Proposed increase',
            pattern: 'hatch' as const,
            increase: true as const,
            values: [0, 90.04],
          },
        ],
      },
    },
    {
      kind: 'chart' as const,
      enlarge: false,
      spec: {
        kind: 'breakdown' as const,
        title: 'Where your City tax share goes, estimated',
        summary: 'Sample: split like an operating budget.',
        unit: 'usd' as const,
        hideSquares: true,
        areas: [
          {
            key: 'safety',
            label: 'Public safety & health',
            value: 1413.57,
            pieces: [
              { key: 'police', label: 'Police', value: 743.86, shown: true as const },
              { key: 'fire', label: 'Fire / EMS', value: 588.71, shown: true as const },
              { key: 'health', label: 'Public Health', value: 80.5 },
            ],
          },
          { key: 'debt', label: 'Debt service', value: 584.1 },
          { key: 'else', label: 'Everything else', value: 514.76 },
          { key: 'works', label: 'Public works', value: 411.22 },
          { key: 'transport', label: 'Transportation', value: 274.77 },
          { key: 'admin', label: 'Administration', value: 267.51 },
        ],
      },
    },
  ],
}

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
        description="A post body with the visual blocks in a row, fact tabs and a chart of each kind between them, rendered as a post page does."
      >
        <GalleryVariant
          label="key facts, fact tabs, charts, timeline, steps and an outcome fork"
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
        <GalleryVariant
          label="three facts where one title wraps and one has no explanation (#678)"
          className="block"
        >
          <KeyFacts facts={UNEVEN_KEY_FACTS} />
        </GalleryVariant>
        <GalleryVariant label="six facts" className="block">
          <KeyFacts facts={[...UNEVEN_KEY_FACTS, ...SAMPLE_KEY_FACTS]} />
        </GalleryVariant>
      </GalleryEntry>

      <GalleryEntry
        name="FactTabs"
        description="Key facts that are tab buttons, each opening its heading, definition and charts or timeline. Every panel is server-rendered: with scripting off they stack under their headings."
      >
        <GalleryVariant label="four tabs, one row at every width" className="block">
          <FactTabs {...FACT_TABS} />
        </GalleryVariant>
        <GalleryVariant
          label="three tabs: the last spans the phone's two columns"
          className="block"
        >
          <FactTabs tabs={FACT_TABS.tabs.slice(1, 4)} />
        </GalleryVariant>
        <GalleryVariant
          label="a whole tax bill first, the rest of the tab under the City's slice"
          className="block"
        >
          <FactTabs tabs={[BILL_TAB]} />
        </GalleryVariant>
        <GalleryVariant label="two tabs, the second one without pictures" className="block">
          <FactTabs
            tabs={FACT_TABS.tabs
              .flatMap((tab, index) =>
                index === 0 ? [{ ...tab, panel: [] }] : index === 3 ? [tab] : [],
              )
              .reverse()}
          />
        </GalleryVariant>
      </GalleryEntry>
    </>
  )
}
