const DEFAULT_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

/**
 * @param {import('playwright').Page} page
 * @param {string} url
 * @param {number} timeoutMs
 */
async function gotoAndExtractBodyText(page, url, timeoutMs) {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: timeoutMs });
  try {
    await page.waitForLoadState("networkidle", { timeout: Math.min(8000, timeoutMs) });
  } catch {
    /* volitelné — stejné chování jako dříve */
  }
  const text = await page.evaluate(() => document.body?.innerText || "");
  return text;
}

/**
 * Jeden sdílený kontext + N stránek v poolu: stejná pečlivost načtení jako u starého
 * `newContext()` na každý odkaz, ale bez opakované režie kontextu (~stovky ms+ na URL).
 *
 * @param {import('playwright').Browser} browser
 * @param {string[]} uniqueUrls
 * @param {{ timeoutMsPerUrl: number, concurrency: number, onProgress?: (p: { stage: string, current: number, total: number }) => void }} opts
 * @returns {Promise<Map<string, { ok: boolean, text: string, error: string | null }>>}
 */
export async function fetchTextsForUrlsPooled(browser, uniqueUrls, opts) {
  const { timeoutMsPerUrl, concurrency, onProgress } = opts;
  const workers = Math.max(1, Math.min(concurrency, 12));

  const ctx = await browser.newContext({ userAgent: DEFAULT_UA, locale: "cs-CZ" });
  /** @type {import('playwright').Page[]} */
  const pages = [];
  try {
    for (let i = 0; i < workers; i++) {
      pages.push(await ctx.newPage());
    }

    const queue = [...uniqueUrls];
    let finished = 0;
    /** @type {Map<string, { ok: boolean, text: string, error: string | null }>} */
    const byUrl = new Map();

    async function runWorker(page) {
      for (;;) {
        const url = queue.shift();
        if (url === undefined) break;
        try {
          const text = await gotoAndExtractBodyText(page, url, timeoutMsPerUrl);
          byUrl.set(url, { ok: true, text, error: null });
        } catch (e) {
          byUrl.set(url, { ok: false, text: "", error: e?.message || String(e) });
        }
        finished += 1;
        onProgress?.({ stage: "fetch", current: finished, total: uniqueUrls.length });
      }
    }

    await Promise.all(pages.map((p) => runWorker(p)));
    return byUrl;
  } finally {
    for (const p of pages) {
      await p.close().catch(() => {});
    }
    await ctx.close().catch(() => {});
  }
}

/**
 * Izolovaný kontext na jednu URL (pomalé pro dávky — ponecháno pro jednorázové použití / testy).
 * @param {import('playwright').Browser} browser
 * @param {string} url
 * @param {number} timeoutMs
 */
export async function fetchPageTextWithBrowser(browser, url, timeoutMs) {
  const ctx = await browser.newContext({ userAgent: DEFAULT_UA, locale: "cs-CZ" });
  const page = await ctx.newPage();
  try {
    return await gotoAndExtractBodyText(page, url, timeoutMs);
  } finally {
    await page.close().catch(() => {});
    await ctx.close().catch(() => {});
  }
}
