function mdEscape(s) {
  return String(s || "").replace(/[\\`*_{}[\]()#+\-.!]/g, "\\$&");
}

function list(items, max = 10) {
  const arr = (items || []).filter(Boolean).slice(0, max);
  if (!arr.length) return "- _(nenalezeno)_";
  return arr.map((x) => `- ${mdEscape(x)}`).join("\n");
}

function scored(items, max = 10) {
  const arr = (items || []).slice(0, max);
  if (!arr.length) return "- _(nenalezeno)_";
  return arr.map((x) => `- ${mdEscape(x.text || "")}`).join("\n");
}

export function renderInsightsMarkdown(report) {
  const s = report.summary || {};
  const brand = report.brand || {};
  const visual = report.visual || {};
  const crawl = report.crawl || {};

  const keyPages = (s.evidence?.keyPages || []).slice(0, 10);

  return [
    `## Scraper – poznatky`,
    ``,
    `- **Web**: ${mdEscape(crawl.rootUrl)}`,
    `- **Analyzováno**: ${mdEscape(report.meta?.analyzedAt)}`,
    `- **Jazyk (odhad)**: ${mdEscape(s.languageGuess || "unknown")}`,
    `- **Tone (odhad)**: ${mdEscape(s.toneGuess || "unknown")}`,
    ``,
    `### Značka a sdělení`,
    ``,
    `**Název (kandidáti)**`,
    list(brand.brand?.nameCandidates, 6),
    ``,
    `**Claimy (kandidáti)**`,
    scored(brand.brand?.claimCandidates, 10),
    ``,
    `### Nabídka`,
    ``,
    `**Služby (kandidáti)**`,
    list(s.offerSummary?.services, 12),
    ``,
    `**Produkty (kandidáti)**`,
    list(s.offerSummary?.products, 12),
    ``,
    `**Segmenty / odvětví**`,
    list(s.offerSummary?.industries, 10),
    ``,
    `### Konverze`,
    ``,
    `**Primární CTA (kandidáti)**`,
    scored(brand.conversion?.primaryCtas, 10),
    ``,
    `**Formuláře (nález)**`,
    (brand.conversion?.formsFound || [])
      .slice(0, 8)
      .map((f) => {
        const fields = (f.fields || [])
          .map((x) => x.name || x.type)
          .filter(Boolean)
          .slice(0, 8)
          .join(", ");
        return `- ${mdEscape(f.url)} — ${mdEscape(fields || "fields")}`;
      })
      .join("\n") || "- _(nenalezeno)_",
    ``,
    `### Důvěryhodnost`,
    ``,
    `**Signály**`,
    (brand.trust?.signals || []).slice(0, 10).map((x) => `- ${mdEscape(x.match)} — ${mdEscape(x.url)}`).join("\n") || "- _(nenalezeno)_",
    ``,
    `**Sociální sítě**`,
    (brand.trust?.socialLinks || []).slice(0, 10).map((x) => `- ${mdEscape(x.platform)} — ${mdEscape(x.href)}`).join("\n") || "- _(nenalezeno)_",
    ``,
    `### Vizuální styl (odhad)`,
    ``,
    `- **Theme**: ${mdEscape(visual.themeGuess || "unknown")}`,
    `- **Top fonty**: ${(visual.typography?.fontsTop || []).slice(0, 5).map((f) => mdEscape(f.value)).join(", ") || "—"}`,
    `- **Palette (text)**: ${(visual.palette?.textColors || []).slice(0, 5).map((c) => mdEscape(c.value)).join(", ") || "—"}`,
    `- **Palette (bg)**: ${(visual.palette?.backgroundColors || []).slice(0, 5).map((c) => mdEscape(c.value)).join(", ") || "—"}`,
    ``,
    `### Procházené stránky (výběr)`,
    ``,
    keyPages.map((p) => `- ${mdEscape(p.url)}${p.title ? ` — ${mdEscape(p.title)}` : ""}`).join("\n") || "- _(nenalezeno)_",
    ``
  ].join("\n");
}

