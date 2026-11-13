import DOMPurify from 'dompurify'

/** Sanitize untrusted converted document HTML before it reaches the comparison view. */
export function sanitizeDocumentHTML(html: string): string {
  return DOMPurify.sanitize(html, { USE_PROFILES: { html: true } })
}
