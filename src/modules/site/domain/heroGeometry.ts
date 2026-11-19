import type { ImageRef } from '@/platform/lib'

/*
 * The home hero is laid out from its photo's horizon, where the trees end and the sky begins
 * (#1304). The upload's focal point marks that line, so an editor moves the layout by setting the
 * point, and a new photo needs no code change.
 */

/** The ratio assumed for an upload that has no size: a widescreen photo */
const FALLBACK_ASPECT = 16 / 9

/** The CSS variables `hero-geometry` (theme/tailwind.css) turns into the photo's height and horizon */
export type HeroPhotoVars = { '--hero-aspect': string; '--hero-focal-y': string }

const round = (value: number, digits: number) => String(Number(value.toFixed(digits)))

/**
 * The photo's ratio and the height of its focal point as a fraction (0 top, 1 bottom). No photo
 * has no horizon (0), so the hero is as tall as its text needs.
 */
export function heroPhotoVars(
  image: Pick<ImageRef, 'width' | 'height' | 'focalY'> | undefined,
): HeroPhotoVars {
  const sized = image?.width && image.height ? image.width / image.height : FALLBACK_ASPECT
  const focal = image ? (image.focalY ?? 50) / 100 : 0
  return {
    '--hero-aspect': round(sized, 4),
    '--hero-focal-y': round(Math.min(1, Math.max(0, focal)), 4),
  }
}
