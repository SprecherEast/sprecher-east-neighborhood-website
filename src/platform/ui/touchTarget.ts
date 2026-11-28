/**
 * A control smaller than 44 px that still has a 44 x 44 px tap area (WCAG 2.5.8): an invisible
 * square, centred on the control, that takes the press. It is centred, not inset from the edges,
 * because an inset is measured from the padding box, which leaves out the control's border, so an
 * inset sized for the outer box comes up short. Used by the checkbox and the switch; a browser
 * measures it in `e2e/touchTargets.spec.ts`.
 */
export const TOUCH_TARGET =
  'relative after:absolute after:top-1/2 after:left-1/2 after:size-11 after:-translate-x-1/2 after:-translate-y-1/2'
