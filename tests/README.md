# Document security regression tests

```sh
npm ci
npx playwright install chromium
npm run test:security
```

The tests launch a local Vite server and run in one Chromium worker. All browser
requests to other origins are blocked. No media uploads or external services are
used. A local installed Chrome can be used instead with
`PLAYWRIGHT_CHANNEL=chrome npm run test:security`.

The suite covers the sanitizer's HTML-only policy, preservation of ordinary DOCX
formatting, and the full `parseDOCX` boundary with a synthetic OOXML file containing
an unsafe hyperlink. The CI workflow also runs the production TypeScript/Vite build.
