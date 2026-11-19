/**
 * What a whole-dollar box shows while the reader types (#1035): the digits grouped by commas after a
 * dollar sign, nothing for no digits. Cents are cut, not read as more digits, so a pasted
 * "$1,250,000.99" stays $1,250,000. Zeros in front are dropped, except while the reader deletes
 * (`keepLeadingZeros`, #1172): deleting a number's first digit leaves "$00,000", ready for the
 * digit that replaces it, rather than a number that has lost its size. Whether the value is
 * allowed is the caller's call.
 */
export function formatMoneyTyping(
  typed: string,
  { keepLeadingZeros = false }: { keepLeadingZeros?: boolean } = {},
): string {
  const dollars = typed.split('.')[0] ?? ''
  const all = dollars.replace(/\D/g, '')
  const digits = keepLeadingZeros ? all : all.replace(/^0+(?=\d)/, '')
  if (digits === '') return ''
  return `$${digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`
}

/** Where the caret goes in `text` so it follows the same number of digits as before the text changed */
export function caretAfterDigits(text: string, digits: number): number {
  if (digits <= 0) return text.startsWith('$') ? 1 : 0
  let seen = 0
  for (let index = 0; index < text.length; index++) {
    if (/\d/.test(text[index] ?? '')) seen++
    if (seen === digits) return index + 1
  }
  return text.length
}
