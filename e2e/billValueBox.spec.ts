import { BILL_POST_PATH as POST } from './support/billRows'
import { expect, test } from './support/test'

// Changing a number's first digit by deleting it and typing another keeps the number's size (#1172)
test('replacing the first digit of the home value keeps its size', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(POST)
  const box = page.getByLabel('Enter your assessed value')
  await box.fill('')
  await box.pressSequentially('500000')
  await expect(box).toHaveValue('$500,000')

  // The caret goes after the 5, Backspace deletes it, and the 6 takes its place
  await box.press('Home')
  await box.press('ArrowRight')
  await box.press('ArrowRight')
  await box.press('Backspace')
  await box.press('6')
  await expect(box).toHaveValue('$600,000')

  // The same with Delete from in front of the digit
  await box.press('Home')
  await box.press('ArrowRight')
  await box.press('Delete')
  await box.press('7')
  await expect(box).toHaveValue('$700,000')

  // Leaving the box with only zeros in front tidies them
  await box.press('Home')
  await box.press('ArrowRight')
  await box.press('Delete')
  await box.press('Tab')
  await expect(box).toHaveValue('$0')
})
