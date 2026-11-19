import React from 'react'

import type { TabsItem } from '../Tabs.client'

/** Three tabs with one paragraph each, for the tests of `Tabs` */
export const TAB_ITEMS: TabsItem[] = [
  { value: 'money', trigger: 'Day-to-day', heading: 'Day-to-day money', panel: <p>Panel one</p> },
  {
    value: 'build',
    trigger: 'Big projects',
    heading: 'Big-project money',
    panel: <p>Panel two</p>,
  },
  { value: 'home', trigger: 'One home', heading: 'One home', panel: <p>Panel three</p> },
]
