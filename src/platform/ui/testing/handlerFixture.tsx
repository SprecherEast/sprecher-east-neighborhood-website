import { Badge } from '../Badge'
import { defineExample } from '../example'

// What the server test of the examples must refuse: `Badge` is a server component, so a handler
// given to it reaches the element it draws, and a server page cannot send a function to the browser
export const Handler = defineExample({
  purpose: 'A pressable badge drawn by a server page',
  render: () => <Badge onPress={() => {}}>Press</Badge>,
})

export const Plain = defineExample({
  purpose: 'A badge with nothing to pass',
  render: () => <Badge>Parks</Badge>,
})
