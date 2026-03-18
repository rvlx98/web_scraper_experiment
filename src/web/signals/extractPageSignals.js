import * as cheerio from "cheerio";
import TurndownService from "turndown";

const turndown = new TurndownService({ headingStyle: "atx" });

function normSpace(s) {
  return String(s || "")
    .replace(/\s+/g, " ")
    .trim();
}

function textFrom($, sel, limit = 500) {
  const t = normSpace($(sel).first().text());
  return t.length > limit ? `${t.slice(0, limit)}…` : t;
}

function pickMeta($) {
  const title = normSpace($("title").first().text());
  const desc = normSpace($('meta[name="description"]').attr("content") || $('meta[property="og:description"]').attr("content"));
  const ogTitle = normSpace($('meta[property="og:title"]').attr("content"));
  const canonical = normSpace($('link[rel="canonical"]').attr("href"));
  return { title: title || ogTitle || null, description: desc || null, canonical: canonical || null };
}

function extractHeadings($) {
  const out = [];
  for (const tag of ["h1", "h2", "h3"]) {
    $(tag).each((_, el) => {
      const t = normSpace($(el).text());
      if (!t) return;
      out.push({ tag, text: t });
    });
  }
  const h1 = out.find((x) => x.tag === "h1")?.text || null;
  return { h1, headings: out.slice(0, 60) };
}

function extractNavLinks($) {
  const links = [];
  const selectors = ["header a[href]", "nav a[href]"];
  for (const sel of selectors) {
    $(sel).each((_, el) => {
      const href = $(el).attr("href");
      const text = normSpace($(el).text());
      if (!href) return;
      if (href.startsWith("#")) return;
      if (!text && !href) return;
      links.push({ href, text: text || null });
    });
  }
  // de-dupe
  const seen = new Set();
  const uniq = [];
  for (const l of links) {
    const k = `${l.href}::${l.text || ""}`;
    if (seen.has(k)) continue;
    seen.add(k);
    uniq.push(l);
  }
  return uniq.slice(0, 80);
}

function extractCTAs($) {
  const items = [];
  const ctaSel = [
    'a[role="button"]',
    "button",
    'a[class*="btn"]',
    'a[class*="button"]',
    'a[class*="cta"]',
    'input[type="submit"]',
    'button[type="submit"]'
  ];
  $(ctaSel.join(",")).each((_, el) => {
    const $el = $(el);
    const text = normSpace($el.text() || $el.attr("value"));
    const href = $el.is("a") ? $el.attr("href") : null;
    if (!text && !href) return;
    items.push({ text: text || null, href: href || null });
  });
  const seen = new Set();
  const uniq = [];
  for (const it of items) {
    const k = `${it.text || ""}::${it.href || ""}`;
    if (seen.has(k)) continue;
    seen.add(k);
    uniq.push(it);
  }
  return uniq.slice(0, 40);
}

function extractForms($) {
  const forms = [];
  $("form").each((_, el) => {
    const $f = $(el);
    const action = $f.attr("action") || null;
    const method = ($f.attr("method") || "get").toLowerCase();
    const inputs = [];
    $f.find("input, textarea, select").each((__, inEl) => {
      const $i = $(inEl);
      const type = ($i.attr("type") || $i[0].tagName || "").toLowerCase();
      const name = $i.attr("name") || null;
      const placeholder = normSpace($i.attr("placeholder"));
      const label = normSpace(
        $i.closest("label").text() ||
          $(`label[for="${$i.attr("id") || ""}"]`).text()
      );
      inputs.push({
        type: type || null,
        name,
        placeholder: placeholder || null,
        label: label || null
      });
    });
    forms.push({ action, method, inputs: inputs.slice(0, 40) });
  });
  return forms.slice(0, 10);
}

function extractSocialLinks($) {
  const domains = ["facebook.com", "instagram.com", "linkedin.com", "tiktok.com", "youtube.com", "x.com", "twitter.com"];
  const found = [];
  $("a[href]").each((_, el) => {
    const href = String($(el).attr("href") || "");
    const lower = href.toLowerCase();
    const dom = domains.find((d) => lower.includes(d));
    if (!dom) return;
    found.push({ href, platform: dom.replace(".com", "") });
  });
  const seen = new Set();
  const uniq = [];
  for (const it of found) {
    if (seen.has(it.href)) continue;
    seen.add(it.href);
    uniq.push(it);
  }
  return uniq.slice(0, 20);
}

function extractImportantTextBlocks($) {
  const candidates = [];
  const sels = ["main", "article", "[role=main]", "body"];
  let $root = null;
  for (const sel of sels) {
    const n = $(sel).first();
    if (n && n.length) {
      $root = n;
      break;
    }
  }
  if (!$root) $root = $("body");

  // paragraphs + list items from primary content
  $root.find("p, li").each((_, el) => {
    const t = normSpace($(el).text());
    if (!t) return;
    if (t.length < 30) return;
    if (t.length > 420) return;
    candidates.push(t);
  });

  // de-dupe
  const seen = new Set();
  const uniq = [];
  for (const t of candidates) {
    const k = t.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    uniq.push(t);
  }
  return uniq.slice(0, 60);
}

function extractImages($, pageUrl) {
  const out = [];

  const og = $('meta[property="og:image"]').attr("content") || $('meta[name="og:image"]').attr("content");
  if (og) out.push({ url: og, alt: null, kind: "og:image", priority: 9, suggestedName: "og-image" });

  const tw = $('meta[name="twitter:image"]').attr("content");
  if (tw) out.push({ url: tw, alt: null, kind: "twitter:image", priority: 8, suggestedName: "twitter-image" });

  const icons = [
    ...$('link[rel="icon"]').toArray(),
    ...$('link[rel="shortcut icon"]').toArray(),
    ...$('link[rel="apple-touch-icon"]').toArray()
  ];
  for (const el of icons.slice(0, 8)) {
    const href = $(el).attr("href");
    if (!href) continue;
    out.push({ url: href, alt: null, kind: "icon", priority: 7, suggestedName: "icon" });
  }

  $("img").each((_, el) => {
    const $img = $(el);
    const src = $img.attr("src") || $img.attr("data-src") || $img.attr("data-lazy-src");
    const alt = normSpace($img.attr("alt"));
    const srcset = $img.attr("srcset");
    if (src) out.push({ url: src, alt: alt || null, kind: "img", priority: 6, suggestedName: alt || "img" });

    // take the largest from srcset (MVP heuristic: last)
    if (srcset) {
      const parts = srcset.split(",").map((x) => x.trim()).filter(Boolean);
      const last = parts[parts.length - 1]?.split(" ")?.[0];
      if (last) out.push({ url: last, alt: alt || null, kind: "img_srcset", priority: 6.5, suggestedName: alt || "img" });
    }
  });

  // make absolute + same-origin will be filtered later in downloader if needed
  const abs = [];
  for (const it of out) {
    try {
      const u = new URL(it.url, pageUrl).toString();
      abs.push({ ...it, url: u });
    } catch {
      // ignore
    }
  }

  // de-dupe
  const seen = new Set();
  const uniq = [];
  for (const it of abs) {
    if (seen.has(it.url)) continue;
    seen.add(it.url);
    uniq.push(it);
  }
  return uniq.slice(0, 120);
}

function extractOfferItems($, pageUrl) {
  const items = [];

  function pushItem({ name, description, priceText, ctaText, href, imageUrl, kind, confidence }) {
    const n = normSpace(name);
    const d = normSpace(description);
    const p = normSpace(priceText);
    const c = normSpace(ctaText);
    if (!n && !d) return;
    items.push({
      kind: kind || "unknown",
      name: n || null,
      description: d || null,
      priceText: p || null,
      ctaText: c || null,
      href: href || null,
      imageUrl: imageUrl || null,
      confidence: confidence ?? 0.5
    });
  }

  // Schema.org hints
  const schemaSelectors = ['[itemtype*="schema.org/Product"]', '[itemtype*="schema.org/Offer"]', '[itemtype*="schema.org/Service"]'];
  $(schemaSelectors.join(",")).each((_, el) => {
    const $el = $(el);
    const name = $el.find('[itemprop="name"]').first().text() || $el.find("h2,h3,h4").first().text();
    const description = $el.find('[itemprop="description"]').first().text() || $el.find("p").first().text();
    const priceText =
      $el.find('[itemprop="price"]').attr("content") ||
      $el.find('[itemprop="price"]').first().text() ||
      $el.find('[itemprop="priceCurrency"]').first().text();
    const a = $el.find("a[href]").first();
    const href = a.attr("href");
    const ctaText = a.text();
    const img = $el.find("img").first().attr("src");
    pushItem({ name, description, priceText, ctaText, href: href ? new URL(href, pageUrl).toString() : null, imageUrl: img ? new URL(img, pageUrl).toString() : null, kind: "schema", confidence: 0.9 });
  });

  // Generic "card-ish" items (pricing / services / products)
  const cardSelectors = [
    '[class*="price" i]',
    '[class*="pricing" i]',
    '[class*="plan" i]',
    '[class*="product" i]',
    '[class*="service" i]',
    '[class*="offer" i]',
    '[class*="card" i]'
  ];
  $(cardSelectors.join(",")).each((_, el) => {
    const $el = $(el);
    const name = $el.find("h1,h2,h3,h4").first().text();
    const description = $el.find("p").first().text();
    const priceText = $el.find('[class*="price" i],[class*="amount" i],[class*="cost" i]').first().text();
    const a = $el.find('a[href],button,[role="button"]').first();
    const href = a.is("a") ? a.attr("href") : null;
    const ctaText = a.text();
    const img = $el.find("img").first().attr("src");
    const text = `${name} ${description} ${priceText}`.trim();
    if (text.length < 16) return;
    pushItem({
      name,
      description,
      priceText,
      ctaText,
      href: href ? new URL(href, pageUrl).toString() : null,
      imageUrl: img ? new URL(img, pageUrl).toString() : null,
      kind: "card",
      confidence: 0.55
    });
  });

  // De-dupe (name+href+price)
  const seen = new Set();
  const uniq = [];
  for (const it of items) {
    const k = `${(it.name || "").toLowerCase()}::${it.href || ""}::${(it.priceText || "").toLowerCase()}`;
    if (seen.has(k)) continue;
    seen.add(k);
    uniq.push(it);
  }
  return uniq.slice(0, 60);
}

export async function extractPageSignals(page, { origin, url }) {
  const html = await page.content();
  const $ = cheerio.load(html);

  const meta = pickMeta($);
  const { h1, headings } = extractHeadings($);
  const navLinks = extractNavLinks($);
  const ctas = extractCTAs($);
  const forms = extractForms($);
  const socialLinks = extractSocialLinks($);
  const importantTextBlocks = extractImportantTextBlocks($);
  const images = extractImages($, url);
  const offerItems = extractOfferItems($, url);

  const discoveredInternalLinks = await page.evaluate(() => {
    const out = [];
    for (const a of document.querySelectorAll("a[href]")) {
      const href = a.getAttribute("href");
      if (!href) continue;
      if (href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:") || href.startsWith("javascript:")) continue;
      out.push(href);
    }
    return out.slice(0, 500);
  });

  // Resolve relative -> absolute and keep only same-origin (done again in crawler, but helps signals)
  const resolvedInternal = [];
  for (const href of discoveredInternalLinks) {
    try {
      const abs = new URL(href, url).toString();
      if (new URL(abs).origin !== origin) continue;
      resolvedInternal.push(abs);
    } catch {
      // ignore
    }
  }

  // Visual + layout signals computed in-browser (more accurate than parsing CSS)
  const visual = await page.evaluate(() => {
    function normColor(c) {
      if (!c) return null;
      const s = String(c).trim();
      if (s === "transparent" || s === "rgba(0, 0, 0, 0)") return null;
      return s;
    }
    function bump(map, key, by = 1) {
      if (!key) return;
      map[key] = (map[key] || 0) + by;
    }

    const body = document.body;
    const bodyStyle = body ? getComputedStyle(body) : null;

    const fonts = {};
    const colors = {};
    const bgColors = {};
    const borderColors = {};

    const sample = Array.from(document.querySelectorAll("h1,h2,h3,p,a,button,nav a,header a,main,section,footer")).slice(0, 350);
    for (const el of sample) {
      const cs = getComputedStyle(el);
      bump(fonts, (cs.fontFamily || "").split(",")[0]?.trim());
      bump(colors, normColor(cs.color));
      bump(bgColors, normColor(cs.backgroundColor));
      bump(borderColors, normColor(cs.borderColor));
    }

    const primaryButtons = Array.from(document.querySelectorAll("a[role=button],button,.btn,.button,[class*='cta']")).slice(0, 50).map((el) => {
      const cs = getComputedStyle(el);
      return {
        text: (el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 80) || null,
        color: normColor(cs.color),
        backgroundColor: normColor(cs.backgroundColor),
        borderColor: normColor(cs.borderColor),
        borderRadius: cs.borderRadius || null,
        fontFamily: (cs.fontFamily || "").split(",")[0]?.trim() || null,
        fontWeight: cs.fontWeight || null,
        textTransform: cs.textTransform || null
      };
    });

    const logoCandidates = [];
    for (const sel of ["header img", "header svg", "nav img", "nav svg", "img[alt*='logo' i]"]) {
      for (const el of document.querySelectorAll(sel)) {
        if (el.tagName.toLowerCase() === "img") {
          const img = el;
          const src = img.currentSrc || img.src || img.getAttribute("src");
          const alt = (img.getAttribute("alt") || "").trim();
          if (src) logoCandidates.push({ type: "img", src, alt: alt || null });
        } else {
          logoCandidates.push({ type: "svg", src: null, alt: null });
        }
        if (logoCandidates.length >= 10) break;
      }
      if (logoCandidates.length >= 10) break;
    }

    function topN(map, n) {
      return Object.entries(map)
        .filter(([k]) => k && k !== "initial" && k !== "inherit")
        .sort((a, b) => b[1] - a[1])
        .slice(0, n)
        .map(([value, count]) => ({ value, count }));
    }

    const layout = {
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      hasStickyHeader: !!Array.from(document.querySelectorAll("header,nav")).find((el) => {
        const cs = getComputedStyle(el);
        return cs.position === "sticky" || cs.position === "fixed";
      })
    };

    return {
      body: bodyStyle
        ? {
            fontFamily: (bodyStyle.fontFamily || "").split(",")[0]?.trim() || null,
            color: normColor(bodyStyle.color),
            backgroundColor: normColor(bodyStyle.backgroundColor)
          }
        : null,
      topFonts: topN(fonts, 10),
      topTextColors: topN(colors, 10),
      topBackgroundColors: topN(bgColors, 10),
      topBorderColors: topN(borderColors, 10),
      primaryButtons,
      logoCandidates,
      layout
    };
  });

  // A lightweight markdown of main content (useful input for AI agent)
  let mainMarkdown = null;
  try {
    const mainHtml = $("main").first().html() || $("article").first().html() || null;
    if (mainHtml) mainMarkdown = turndown.turndown(mainHtml).slice(0, 16000);
  } catch {
    // ignore
  }

  return {
    meta,
    h1,
    headings,
    navLinks,
    ctas,
    forms,
    socialLinks,
    importantTextBlocks,
    offerItems,
    mainMarkdown,
    discoveredInternalLinks: resolvedInternal.slice(0, 200),
    images,
    visual
  };
}

