import type { Metadata } from 'next'
import { getServerSideURL } from '@/platform/lib/getURL'
import { SITE_NAME } from './siteName'

const defaultOpenGraph: Metadata['openGraph'] = {
  type: 'website',
  description: "An unofficial site for Sprecher East on Madison's Far East Side.",
  images: [
    {
      url: `${getServerSideURL()}/images/photo.jpeg`,
    },
  ],
  siteName: SITE_NAME,
  title: SITE_NAME,
}

export const mergeOpenGraph = (og?: Metadata['openGraph']): Metadata['openGraph'] => {
  return {
    ...defaultOpenGraph,
    ...og,
    images: og?.images ? og.images : defaultOpenGraph.images,
  }
}
