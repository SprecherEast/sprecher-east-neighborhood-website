import type { StaticImageData } from 'next/image'
import type { ElementType, Ref } from 'react'

import type { IMAGE_QUALITIES } from '@/imageQualities'
import type { Media as MediaType } from '@/payload-types'

export interface MediaProps {
  alt?: string
  className?: string
  fill?: boolean // for NextImage only
  htmlElement?: ElementType | null
  pictureClassName?: string
  imgClassName?: string
  onClick?: () => void
  onLoad?: () => void
  loading?: 'lazy' | 'eager' // for NextImage only
  priority?: boolean // for NextImage only
  quality?: (typeof IMAGE_QUALITIES)[keyof typeof IMAGE_QUALITIES] // for NextImage only; `full` when left out
  ref?: Ref<HTMLImageElement | HTMLVideoElement | null>
  resource?: MediaType | string | number | null // for Payload media
  size?: string // for NextImage only
  src?: StaticImageData // for static media
  videoClassName?: string
}
