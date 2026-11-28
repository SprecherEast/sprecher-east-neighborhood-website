import { describe, expect, it } from 'vitest'

import { readExamples as readWith } from './examplesReader.mjs'
import { read, withBody } from './examplesFixture.mjs'

const body = (code) =>
  read(`export const A = defineExample({ purpose: 'x', render: () => { ${code} } })\n`)
const refused = (code, pattern) => expect(() => body(code), code).toThrow(pattern)

/** An examples file may draw only what a static page can: allowed elements, imported components. */
describe('readExamples: markup is allowed by list, not refused by list', () => {
  it('draws the elements on the allow list, imported components and its own components', () => {
    for (const code of [
      'return <div><span>x</span><p>y</p><ul><li><strong>a</strong><em>b</em></li></ul></div>',
      'return <Thing />',
      'return <Thing.Part />',
      'return <svg viewBox="0 0 4 4"><g><path d="M0 0" /><circle r="1" /><rect /><line /></g></svg>',
      'return <><div /></>',
    ]) {
      expect(() => body(code), code).not.toThrow()
    }
    expect(() =>
      read(
        `function Row() { return <div /> }\nconst Cell = () => <span />\n${withBody('render: () => <><Row /><Cell /></>')}`,
      ),
    ).not.toThrow()
  })

  it('refuses an element that loads or runs something, or is not on the list', () => {
    for (const tag of [
      'script',
      'iframe',
      'object',
      'embed',
      'link',
      'meta',
      'base',
      'form',
      'style',
      'video',
      'audio',
      'source',
      'track',
      'picture',
      'img',
      'image',
      'use',
      'foreignObject',
      'frame',
      'frameset',
      'portal',
      'canvas',
      'template',
      'noscript',
      'a',
      'button',
      'input',
      'svg:script',
      'my-element',
    ]) {
      refused(`return <${tag} />`, /A: uses <.+>, which is not an element an example may draw/)
    }
    refused('return <svg><image href="/a.png" /></svg>', /uses <image>/)
    refused('return <svg><use href="#a" /></svg>', /uses <use>/)
  })

  it('refuses a component that is not imported or written in the file, and a computed element name', () => {
    refused('const S = \'script\'; return <S src="/a.js" />', /uses <S>/)
    refused('const S = props.as; return <S />', /uses <S>/)
    refused('return <Elsewhere />', /uses <Elsewhere>/)
    refused('return <Unknown.Part />', /uses <Unknown\.Part>/)
    refused('return <this.X />', /uses <this\.X>/)
  })

  it('refuses ways to make an element from a value', () => {
    for (const code of [
      "return createElement('iframe')",
      "return React.createElement('script')",
      'return cloneElement(x)',
      "return jsx('script', {})",
      "return jsxs('script', {})",
    ]) {
      refused(code, /A: reaches (createElement|cloneElement|jsx|jsxs)/)
    }
  })

  it('refuses a style or string that loads something with url( or @import', () => {
    for (const code of [
      "return <div style={{ backgroundImage: 'url(https://x/a.png)' }} />",
      "const a = 'URL (x)'",
      "const a = 'image-set(x)'",
      "const a = 'src(x)'",
      'const a = \'@import "x"\'',
      'const a = `url(${1})`',
    ]) {
      refused(code, /A: (has|uses) .*(url|address)/)
    }
    expect(() => body("const a = 'a url and a link'")).not.toThrow()
  })

  it('refuses an address that is not relative, a fragment or a reserved example address', () => {
    for (const code of [
      'return <Thing src="https://x/a.png" />',
      'return <Thing srcSet="https://x/a.png 2x" />',
      'return <Thing href="https://evil.test" />',
      'return <Thing href="//evil.test" />',
      'return <Thing href="javascript:alert(1)" />',
      'return <Thing href="data:text/html,x" />',
      'return <Thing href="ja\tvascript:x" />',
      'return <Thing poster="https://example.com/a.png" />',
      'return <Thing src={url} />',
      'return <Thing href="\\x" />',
      'return <Thing href="/\\x" />',
      'return <Thing action="https://x" />',
    ]) {
      refused(code, /A: (passes|has) /)
    }
    for (const code of [
      'return <Thing href="/news" />',
      'return <Thing href="#as-link" />',
      'return <Thing href="../news" />',
      'return <Thing href="https://example.com" />',
      'return <Thing href="https://www.example.org/a" />',
      'return <Thing src="/a.png" />',
    ]) {
      expect(() => body(code), code).not.toThrow()
    }
  })

  it('refuses the member names that reach the page from an element, however written', () => {
    for (const name of [
      'innerHTML',
      'outerHTML',
      'insertAdjacentHTML',
      'insertAdjacentElement',
      'insertAdjacentText',
      'ownerDocument',
      'defaultView',
      'srcdoc',
      'srcDoc',
      'contentWindow',
      'contentDocument',
    ]) {
      refused(`const f = (e) => { e.${name} = 'x' }`, new RegExp(`reaches ${name}`))
      refused(`const f = (e) => e['${name}']`, new RegExp(`reaches ${name}`))
    }
    refused(
      'const f = (e) => e.currentTarget.ownerDocument.location.assign("/")',
      /reaches ownerDocument/,
    )
  })

  it('refuses the network and page names that were missing', () => {
    for (const name of [
      'RTCPeerConnection',
      'WebTransport',
      'fetchLater',
      'cookieStore',
      'CSS',
      'alert',
      'confirm',
      'prompt',
      'Audio',
      'Notification',
    ]) {
      refused(`const x = ${name}`, new RegExp(`references ${name}`))
    }
  })

  it('is judged the same with the real policy (isKitFile given)', () => {
    expect(() =>
      readWith(
        `import { defineExample } from './example'\nexport const A = defineExample({ purpose: 'x', render: () => <script /> })\n`,
        'src/platform/ui/Thing.examples.tsx',
        { isKitFile: () => true },
      ),
    ).toThrow(/uses <script>/)
  })
})
