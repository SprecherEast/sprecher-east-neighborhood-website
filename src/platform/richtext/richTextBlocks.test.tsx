import type { SerializedBlockNode } from '@payloadcms/richtext-lexical'
import type { JSXConverterArgs } from '@payloadcms/richtext-lexical/react'
import { describe, expect, it } from 'vitest'

import { READING_WIDTH } from '@/platform/ui/layoutSizes'

import type {
  BannerBlock as BannerFields,
  MediaBlock as MediaFields,
  DiagramKeyBlock as DiagramKeyFields,
  KeyFactsBlock as KeyFactsFields,
  OutcomeForkBlock as OutcomeForkFields,
  StepsBlock as StepsFields,
  TimelineBlock as TimelineFields,
} from '@/payload-types'

import { BannerBlock } from './BannerBlock'
import { RICH_TEXT_BLOCKS } from './blockConfigs'
import { CodeBlock, type CodeBlockProps } from './CodeBlock'
import { DiagramKey } from './editorial/DiagramKey'
import { KeyFacts } from './editorial/KeyFacts'
import { OutcomeFork } from './editorial/OutcomeFork'
import { Steps } from './editorial/Steps'
import { Timeline } from './editorial/Timeline'
import { MediaBlock } from './MediaBlock'
import { richTextBlocks } from './richTextBlocks'

/** The arguments Lexical passes a block renderer; these renderers read only `node`. */
const argsFor = <T extends { blockType: string }>(fields: T) =>
  ({ node: { type: 'block', version: 2, format: '', fields } }) as unknown as JSXConverterArgs<
    SerializedBlockNode<T>
  >

describe('richTextBlocks', () => {
  it('has a renderer for every block a post may hold, and no other', () => {
    expect(Object.keys(richTextBlocks).sort()).toEqual(
      RICH_TEXT_BLOCKS.map((block) => block.slug).sort(),
    )
  })

  it('draws a banner in the middle column', () => {
    const content: BannerFields['content'] = {
      root: { type: 'root', children: [], direction: null, format: '', indent: 0, version: 1 },
    }
    const fields: BannerFields = { blockType: 'banner', style: 'warning', content }
    const element = richTextBlocks.banner(argsFor(fields))

    expect(element.type).toBe(BannerBlock)
    expect(element.props).toMatchObject({ className: 'col-start-2 mb-4', style: 'warning' })
  })

  it('draws a code block in the middle column', () => {
    const fields: CodeBlockProps = { blockType: 'code', code: 'let a = 1', language: 'css' }
    const element = richTextBlocks.code(argsFor(fields))

    expect(element.type).toBe(CodeBlock)
    expect(element.props).toMatchObject({
      className: 'col-start-2',
      code: 'let a = 1',
      language: 'css',
    })
  })

  it('draws a media block inline, with no section padding or container of its own', () => {
    const fields: MediaFields = { blockType: 'mediaBlock', media: 4 }
    const element = richTextBlocks.mediaBlock(argsFor(fields))

    expect(element.type).toBe(MediaBlock)
    expect(element.props).toMatchObject({
      placement: 'inline',
      captionClassName: `mx-auto ${READING_WIDTH}`,
      media: 4,
    })
  })

  it('draws a timeline in the middle column, from plain props', () => {
    const fields: TimelineFields = {
      blockType: 'timeline',
      entries: [
        { date: '2024', status: 'done', title: 'Decision' },
        { date: '2040s', status: 'later', title: 'Construction' },
      ],
    }
    const element = richTextBlocks.timeline(argsFor(fields))

    expect(element.type).toBe(Timeline)
    expect(element.props.className).toBe('col-start-2')
    expect(element.props.entries.map((entry: { title: string }) => entry.title)).toEqual([
      'Decision',
      'Construction',
    ])
  })

  it('draws steps, key facts and an outcome fork in the middle column, from plain props', () => {
    const steps: StepsFields = {
      blockType: 'steps',
      steps: [{ heading: 'Join' }, { heading: 'Vote' }],
    }
    const facts: KeyFactsFields = {
      blockType: 'keyFacts',
      facts: [
        { value: '2040s', label: 'build', icon: 'date', certainty: 'estimate' },
        { value: '?', label: 'cost', icon: 'money', certainty: 'unknown' },
      ],
    }
    const fork: OutcomeForkFields = {
      blockType: 'outcomeFork',
      question: 'Deal?',
      outcomes: [
        { title: 'Yes', tone: 'go', description: 'Go.' },
        { title: 'No', tone: 'stop', description: 'Stop.' },
      ],
    }

    const stepsElement = richTextBlocks.steps(argsFor(steps))
    expect(stepsElement.type).toBe(Steps)
    expect(stepsElement.props).toMatchObject({ className: 'col-start-2' })
    expect(stepsElement.props.steps).toHaveLength(2)

    const factsElement = richTextBlocks.keyFacts(argsFor(facts))
    expect(factsElement.type).toBe(KeyFacts)
    expect(factsElement.props.facts.map((fact: { value: string }) => fact.value)).toEqual([
      '2040s',
      '?',
    ])

    const forkElement = richTextBlocks.outcomeFork(argsFor(fork))
    expect(forkElement.type).toBe(OutcomeFork)
    expect(forkElement.props).toMatchObject({ className: 'col-start-2', question: 'Deal?' })
  })

  it('draws a diagram key in the middle column, from plain props', () => {
    const fields: DiagramKeyFields = {
      blockType: 'diagramKey',
      items: [{ label: 'North roundabout' }, { label: 'Westbound loop', text: 'Onto I-94 west.' }],
    }
    const element = richTextBlocks.diagramKey(argsFor(fields))

    expect(element.type).toBe(DiagramKey)
    expect(element.props.className).toBe('col-start-2')
    expect(element.props.items).toHaveLength(2)
  })
})
