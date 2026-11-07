import type { Block } from 'payload'

import { MediaBlock } from '@/platform/richtext/blockConfigs'

import { Archive } from './archiveBlock'
import { CallToAction } from './callToActionBlock'
import { Content } from './contentBlock'
import { MapBlock } from './mapBlock'

/** The site's own page-builder blocks, in the order editors see them. */
export const SITE_LAYOUT_BLOCKS: Block[] = [CallToAction, Content, MediaBlock, MapBlock, Archive]
