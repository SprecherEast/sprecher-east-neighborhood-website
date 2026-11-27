'use client'

import { useFieldControl } from './fieldContext'
import { SwitchControl, type SwitchControlProps } from './Switch.client'

export type FieldSwitchProps = Omit<SwitchControlProps, 'id'>

/**
 * An on or off switch for a form; place it inside a `Field`, which then lays out inline with the
 * label after the switch. With react-hook-form, render it through a `Controller` (`checked`,
 * `onCheckedChange`).
 */
export function FieldSwitch(props: FieldSwitchProps) {
  const field = useFieldControl('Field.Switch')
  return <SwitchControl {...props} {...field} />
}
