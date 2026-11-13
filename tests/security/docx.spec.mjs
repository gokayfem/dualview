import { readFile } from 'node:fs/promises'
import { test, expect } from '@playwright/test'

// No application uploads, external images, or network services are needed.
test.beforeEach(async ({ page }) => {
  await page.route('**/*', route => {
    const url = new URL(route.request().url())
    return url.origin === 'http://127.0.0.1:4179' ? route.continue() : route.abort()
  })
  await page.goto('/tests/fixtures/blank.html')
})

test('preserves ordinary document formatting and safe links', async ({ page }) => {
  const html = '<h1>Title</h1><p><strong>Bold</strong> and <em>italic</em> text<br>Next line</p><ul><li>Item</li></ul><table><tbody><tr><td>Cell</td></tr></tbody></table><a href="https://example.com/">Reference</a>'
  const sanitized = await page.evaluate(async html => {
    const { sanitizeDocumentHTML } = await import('/src/lib/sanitizeDocumentHTML.ts')
    return sanitizeDocumentHTML(html)
  }, html)
  expect(sanitized).toBe(html)
})

test('removes active content, event handlers and executable URLs before rendering', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const { sanitizeDocumentHTML } = await import('/src/lib/sanitizeDocumentHTML.ts')
    window.__docxXss = 0
    const malicious = `
      <p>Retained text</p><script>window.__docxXss=1</script>
      <img src="data:image/png;base64," onerror="window.__docxXss=1">
      <a href="javascript:window.__docxXss=1" onclick="window.__docxXss=1">Direct</a>
      <a href="jAvA&#x09;script:window.__docxXss=1">Obfuscated</a>
      <a href="data:text/html,&lt;script&gt;alert(1)&lt;/script&gt;">Data</a>
      <iframe srcdoc="&lt;script&gt;window.__docxXss=1&lt;/script&gt;"></iframe>
      <object data="javascript:window.__docxXss=1"></object><embed src="javascript:window.__docxXss=1">
      <svg onload="window.__docxXss=1"><a href="javascript:window.__docxXss=1">SVG</a></svg>
      <math><mtext><img src="x" onerror="window.__docxXss=1"></mtext></math>`
    const host = document.createElement('div')
    host.innerHTML = sanitizeDocumentHTML(malicious)
    document.body.append(host)
    for (const anchor of host.querySelectorAll('a')) anchor.click()
    for (const image of host.querySelectorAll('img')) image.dispatchEvent(new Event('error'))
    return {
      text: host.textContent,
      activeElements: host.querySelectorAll('script,iframe,object,embed,svg,math').length,
      events: [...host.querySelectorAll('*')].flatMap(el => [...el.attributes]).filter(attr => /^on/i.test(attr.name)).length,
      linkTargets: [...host.querySelectorAll('a')].map(el => el.getAttribute('href')),
      executed: window.__docxXss,
    }
  })
  expect(result.text).toContain('Retained text')
  expect(result.activeElements).toBe(0)
  expect(result.events).toBe(0)
  expect(result.linkTargets).toEqual([null, null, null])
  expect(result.executed).toBe(0)
})

test('sanitizes actual Mammoth output from a DOCX without losing text or metadata', async ({ page }) => {
  const fixture = await readFile(new URL('../fixtures/docx-security.docx', import.meta.url))
  const result = await page.evaluate(async bytes => {
    const { parseDOCX, mammoth } = await import('/tests/fixtures/document-parser.js')
    const file = new File([new Uint8Array(bytes)], 'docx-security.docx', {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    })
    const raw = await mammoth.convertToHtml({ arrayBuffer: await file.arrayBuffer() })
    const metadata = await parseDOCX(file)
    const host = document.createElement('div')
    host.innerHTML = metadata.parsedContent.html
    document.body.append(host)
    window.__docxXss = 0
    const unsafe = [...host.querySelectorAll('a')].find(link => link.textContent === 'Unsafe link')
    unsafe.click()
    return {
      rawContainsUnsafeLink: raw.value.includes('href="javascript:'),
      html: metadata.parsedContent.html,
      text: metadata.parsedContent.text,
      type: metadata.parsedContent.type,
      wordCount: metadata.wordCount,
      paragraphCount: metadata.paragraphCount,
      unsafeTarget: unsafe.getAttribute('href'),
      executed: window.__docxXss,
    }
  }, [...fixture])
  expect(result.rawContainsUnsafeLink).toBe(true)
  expect(result.type).toBe('docx')
  expect(result.html).toContain('<h1>Security fixture</h1>')
  expect(result.html).toContain('<strong>Bold text</strong>')
  expect(result.html).toContain('<em>italic text</em>')
  expect(result.html).toContain('<td><p>Table cell</p></td>')
  expect(result.html).toContain('<a href="https://example.com/documentation">Safe link</a>')
  expect(result.unsafeTarget).toBeNull()
  expect(result.executed).toBe(0)
  expect(result.text).toBe('Security fixture\n\nBold text and italic text\n\nSafe link Unsafe link\n\nTable cell\n\n')
  expect(result.wordCount).toBe(13)
  expect(result.paragraphCount).toBe(4)
})
