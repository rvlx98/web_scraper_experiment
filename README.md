# AI web analytik (MVP) – Node.js

MVP aplikace, která:

- vezme URL webu
- projde několik interních stránek (Playwright = funguje i na JS webech)
- vytáhne praktické signály pro AI agenta, který má následně postavit nový web
- vygeneruje **strukturovaný JSON** + **lidsky čitelný Markdown report**

## Požadavky

- Node.js 20+ (doporučeno)

## Instalace

```bash
npm install
npx playwright install --with-deps chromium
```

## Spuštění

### Web UI + API

```bash
npm start
```

Otevři `http://localhost:3000`.

### CLI

```bash
npm run cli -- https://example.com
```

Volitelně:

- `MAX_PAGES=12`
- `MAX_DEPTH=2`

## API

- `POST /api/analyze`

Body:

```json
{
  "url": "https://example.com",
  "maxPages": 12,
  "maxDepth": 2,
  "timeoutMsPerPage": 25000,
  "allowExternalAssets": true
}
```

Vrací: `{ "id": "1" }`

- `GET /api/jobs/:id` – stav
- `GET /api/jobs/:id/report.json` – kompletní JSON
- `GET /api/jobs/:id/report.md` – Markdown report

## Poznámky k MVP

- Respektuje `robots.txt` pro `User-agent: *` (základní varianta).
- Prioritizuje „důležité“ stránky (home, služby, ceník, kontakt, reference…).
- Vizuální styl se odhaduje z computed styles (barvy, fonty, buttony).

