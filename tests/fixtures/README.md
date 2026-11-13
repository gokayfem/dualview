# DOCX security fixture

`docx-security.docx` is a synthetic, deterministic ZIP archive containing only five
OOXML text parts, created locally for these tests. It contains a heading, bold and
italic text, a table cell, a normal HTTPS hyperlink, and a hyperlink whose target is
`javascript:window.__docxXss=1`. It contains no personal data, external images,
macros, or embedded executables. Its XML can be inspected with `unzip -p`.

The test verifies that Mammoth actually emits the unsafe hyperlink before checking
that `parseDOCX` removes its target and preserves the rest of the document.
