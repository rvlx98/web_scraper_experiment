function mdEscape(s) {
  return String(s || "").replace(/[\\`*_{}[\]()#+\-.!]/g, "\\$&");
}

function asList(items, max = 10) {
  const arr = (items || []).filter(Boolean).slice(0, max);
  if (!arr.length) return "_(nenalezeno)_";
  return arr.map((x) => `- ${mdEscape(x)}`).join("\n");
}

function asKeyValueList(items, max = 10) {
  const arr = (items || []).slice(0, max);
  if (!arr.length) return "_(nenalezeno)_";
  return arr
    .map((x) => `- **${mdEscape(x.value || "")}** (${x.count ?? "?"})`)
    .join("\n");
}

export function renderReportMarkdown(report) {
  const s = report.summary;
  const brand = report.brand;
  const visual = report.visual;
  const crawl = report.crawl;

  const keyPages = (s.evidence?.keyPages || []).slice(0, 12);

  return [
    `## AI web analytik – report`,
    ``,
    `- **Analyzováno**: ${mdEscape(report.meta?.analyzedAt)}`,
    `- **Root URL**: ${mdEscape(crawl?.rootUrl)}`,
    `- **Navštíveno stránek**: ${crawl?.stats?.visitedPages ?? "?"} (seen: ${crawl?.stats?.seenUrls ?? "?"})`,
    ``,
    `## Shrnutí`,
    ``,
    `- **Název (odhad)**: ${mdEscape(s.siteNameGuess || "—")}`,
    `- **Jazyk (odhad)**: ${mdEscape(s.languageGuess || "unknown")}`,
    `- **Tone (odhad)**: ${mdEscape(s.toneGuess || "unknown")}`,
    ``,
    `### Primární claimy`,
    ``,
    asList(s.primaryClaims, 8),
    ``,
    `### Primární CTA`,
    ``,
    asList(s.primaryCtas, 8),
    ``,
    `## Nabídka (kandidáti)`,
    ``,
    `### Služby`,
    ``,
    asList(s.offerSummary?.services, 12),
    ``,
    `### Produkty`,
    ``,
    asList(s.offerSummary?.products, 12),
    ``,
    `### Segmenty / odvětví`,
    ``,
    asList(s.offerSummary?.industries, 10),
    ``,
    `## Důvěryhodnost`,
    ``,
    `### Signály (výřezy)`,
    ``,
    (brand.trust?.signals || []).slice(0, 12).map((x) => `- **${mdEscape(x.match)}** — ${mdEscape(x.url)}`).join("\n") ||
      "_(nenalezeno)_",
    ``,
    `### Sociální sítě`,
    ``,
    (brand.trust?.socialLinks || []).slice(0, 12).map((x) => `- **${mdEscape(x.platform)}** — ${mdEscape(x.href)}`).join("\n") ||
      "_(nenalezeno)_",
    ``,
    `## Vizuální styl (odhad)`,
    ``,
    `- **Theme**: ${mdEscape(visual.themeGuess || "unknown")}`,
    ``,
    `### Typografie (top fonty)`,
    ``,
    asKeyValueList(visual.typography?.fontsTop, 8),
    ``,
    `### Barvy – text`,
    ``,
    asKeyValueList(visual.palette?.textColors, 8),
    ``,
    `### Barvy – pozadí`,
    ``,
    asKeyValueList(visual.palette?.backgroundColors, 8),
    ``,
    `### Barvy – border`,
    ``,
    asKeyValueList(visual.palette?.borderColors, 6),
    ``,
    `### Primární button (vzorky)`,
    ``,
    (visual.components?.primaryButtons || []).slice(0, 8).map((b) => {
      const parts = [
        b.text ? `“${mdEscape(b.text)}”` : null,
        b.backgroundColor ? `bg=${mdEscape(b.backgroundColor)}` : null,
        b.color ? `fg=${mdEscape(b.color)}` : null,
        b.borderRadius ? `radius=${mdEscape(b.borderRadius)}` : null,
        b.fontFamily ? `font=${mdEscape(b.fontFamily)}` : null
      ].filter(Boolean);
      return `- ${parts.join(" · ")} (${mdEscape(b.url)})`;
    }).join("\n") || "_(nenalezeno)_",
    ``,
    `## Procházené stránky (výběr)`,
    ``,
    keyPages.map((p) => `- ${mdEscape(p.url)}${p.title ? ` — ${mdEscape(p.title)}` : ""}`).join("\n") || "_(nenalezeno)_",
    ``,
    `## Poznámky k použití jako vstup pro AI (builder)`,
    ``,
    `- Z JSON výstupu použij hlavně: \`summary\`, \`brand\`, \`visual\` a u stránek \`mainMarkdown\` + \`importantTextBlocks\`.`,
    `- Pro přímé použití v chatu je k dispozici \`/api/jobs/:id/report.prompt.md\` (prompt pro re-design agenta).`,
    `- Pokud chceš přesnější „design system“, dá se přidat screenshot + extrakce dominantních barev z obrázku (další krok).`,
    ``
  ].join("\n");
}

