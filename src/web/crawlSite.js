import normalizeUrl from "normalize-url";
import robotsParser from "robots-parser";
import pLimit from "p-limit";
import { chromium } from "playwright";
import { classifyUrlPriority, getSameOrigin, toCanonicalUrl } from "./utils/url.js";
import { fetchRobotsTxt } from "./utils/robots.js";
import { extractPageSignals } from "./signals/extractPageSignals.js";

function normalizeRoot(url) {
  return normalizeUrl(url, {
    stripHash: true,
    stripWWW: false,
    removeTrailingSlash: true,
    removeSingleSlash: true,
    sortQueryParameters: true
  });
}

export async function crawlSite({ url, maxPages, maxDepth, timeoutMsPerPage, allowExternalAssets }) {
  const rootUrl = url;
  const normalizedRoot = normalizeRoot(rootUrl);
  const origin = getSameOrigin(normalizedRoot);

  const robotsTxt = await fetchRobotsTxt(origin);
  const robots = robotsParser(`${origin}/robots.txt`, robotsTxt ?? "");

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123 Safari/537.36",
    ignoreHTTPSErrors: true
  });

  if (!allowExternalAssets) {
    await context.route("**/*", (route) => {
      try {
        const reqUrl = new URL(route.request().url());
        if (reqUrl.origin !== origin) return route.abort();
      } catch {
        // ignore
      }
      return route.continue();
    });
  }

  const pages = [];
  const seen = new Set();
  const queue = [];

  function enqueue(candidateUrl, depth, fromUrl) {
    const canon = toCanonicalUrl(candidateUrl);
    if (!canon) return;
    try {
      const u = new URL(canon);
      if (u.origin !== origin) return;
      if (seen.has(canon)) return;
      if (!robots.isAllowed(canon, "*")) return;
      seen.add(canon);
      queue.push({ url: canon, depth, fromUrl, priority: classifyUrlPriority(u) });
    } catch {
      // ignore
    }
  }

  enqueue(normalizedRoot, 0, null);

  const limit = pLimit(3);

  async function visitOne(task) {
    const page = await context.newPage();
    page.setDefaultTimeout(timeoutMsPerPage);
    page.setDefaultNavigationTimeout(timeoutMsPerPage);

    const startedAt = Date.now();
    let finalUrl = task.url;
    let status = null;
    let error = null;
    try {
      const resp = await page.goto(task.url, { waitUntil: "domcontentloaded" });
      status = resp?.status() ?? null;
      finalUrl = page.url();
      await page.waitForLoadState("networkidle", { timeout: Math.min(8000, timeoutMsPerPage) }).catch(() => {});

      const signals = await extractPageSignals(page, { origin, url: finalUrl });
      pages.push({
        url: finalUrl,
        fromUrl: task.fromUrl,
        depth: task.depth,
        status,
        timingMs: Date.now() - startedAt,
        ...signals
      });

      // Discover links
      for (const href of signals.discoveredInternalLinks) {
        if (task.depth + 1 > maxDepth) continue;
        enqueue(href, task.depth + 1, finalUrl);
      }
    } catch (e) {
      error = e?.message || String(e);
      pages.push({
        url: task.url,
        fromUrl: task.fromUrl,
        depth: task.depth,
        status,
        timingMs: Date.now() - startedAt,
        error
      });
    } finally {
      await page.close().catch(() => {});
    }
  }

  while (queue.length && pages.length < maxPages) {
    queue.sort((a, b) => b.priority - a.priority || a.depth - b.depth);
    const batch = queue.splice(0, Math.min(3, maxPages - pages.length));
    await Promise.all(batch.map((t) => limit(() => visitOne(t))));
  }

  await context.close().catch(() => {});
  await browser.close().catch(() => {});

  return {
    rootUrl,
    normalizedRoot,
    robots: {
      fetched: robotsTxt != null,
      hasRobotsTxt: robotsTxt != null,
      allowAllByDefault: robotsTxt == null,
      robotsTxt: robotsTxt ?? null
    },
    stats: {
      visitedPages: pages.length,
      queuedButNotVisited: queue.length,
      seenUrls: seen.size
    },
    pages
  };
}

