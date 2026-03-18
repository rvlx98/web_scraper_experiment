function mdEscape(s) {
  return String(s || "").replace(/[\\`*_{}[\]()#+\-.!]/g, "\\$&");
}

function bullets(items, max = 10) {
  const arr = (items || []).filter(Boolean).slice(0, max);
  if (!arr.length) return "- _(nenalezeno)_";
  return arr.map((x) => `- ${mdEscape(x)}`).join("\n");
}

function kvBullets(items, max = 10) {
  const arr = (items || []).slice(0, max);
  if (!arr.length) return "- _(nenalezeno)_";
  return arr.map((x) => `- **${mdEscape(x.value || "")}** (${x.count ?? "?"})`).join("\n");
}

function pickPagesForPrompt(pages, max = 6) {
  const out = [];
  for (const p of pages || []) {
    if (p?.error) continue;
    if (!p?.url) continue;
    out.push(p);
    if (out.length >= max) break;
  }
  return out;
}

export function renderAgentPromptMarkdown(report) {
  const s = report.summary;
  const brand = report.brand;
  const visual = report.visual;
  const pages = report.crawl?.pages || [];
  const assets = report.assets;

  const evidencePages = pickPagesForPrompt(pages, 6);

  const styleText = [
    `Theme guess: ${mdEscape(visual.themeGuess || "unknown")}`,
    `Top fonts: ${(visual.typography?.fontsTop || []).slice(0, 5).map((f) => mdEscape(f.value)).join(", ") || "—"}`,
    `Top text colors: ${(visual.palette?.textColors || []).slice(0, 5).map((c) => mdEscape(c.value)).join(", ") || "—"}`,
    `Top bg colors: ${(visual.palette?.backgroundColors || []).slice(0, 5).map((c) => mdEscape(c.value)).join(", ") || "—"}`
  ].join("\n");

  return [
    `## PROMPT PRO AI AGENTA – re-design webu`,
    ``,
    `Jsi seniorní webový stratég + UX/UI designer + copywriter + front-end architekt.`,
    `Tvůj cíl: **navrhnout re-design a strukturu nového webu** podle analýzy níže. Zachovej smysl značky, ale zlepši jasnost nabídky, konverze, informační architekturu a vizuální konzistenci.`,
    ``,
    `### Vstup (shrnutí z analýzy)`,
    ``,
    `- **Zdrojový web**: ${mdEscape(report.crawl?.rootUrl)}`,
    `- **Název (odhad)**: ${mdEscape(s.siteNameGuess || "—")}`,
    `- **Jazyk**: ${mdEscape(s.languageGuess || "unknown")}`,
    `- **Tone**: ${mdEscape(s.toneGuess || "unknown")}`,
    ``,
    `#### Primární claimy (kandidáti)`,
    bullets(s.primaryClaims, 8),
    ``,
    `#### Primární CTA (kandidáti)`,
    bullets(s.primaryCtas, 8),
    ``,
    `#### Nabídka (kandidáti)`,
    ``,
    `**Služby**`,
    bullets(s.offerSummary?.services, 12),
    ``,
    `**Produkty**`,
    bullets(s.offerSummary?.products, 12),
    ``,
    `**Segmenty / odvětví**`,
    bullets(s.offerSummary?.industries, 10),
    ``,
    `#### Důvěryhodnost – signály`,
    (brand.trust?.signals || [])
      .slice(0, 10)
      .map((x) => `- **${mdEscape(x.match)}** — ${mdEscape(x.url)}`)
      .join("\n") || "- _(nenalezeno)_",
    ``,
    `#### Vizuální styl – rychlý odhad`,
    ``,
    styleText,
    ``,
    `#### Asset pack (obrázky pro dalšího agenta)`,
    assets?.images?.length
      ? [
          `- Stažené obrázky jsou dostupné lokálně i přes server:`,
          `  - folder: ${mdEscape(assets.dir?.absPath || "—")}`,
          `  - public: ${mdEscape(assets.dir?.publicPath || "—")}`,
          ``,
          ...assets.images.slice(0, 20).map((im) => `- ${mdEscape(im.file?.publicPath || im.file?.absPath || "")} — ${mdEscape(im.kind)}${im.alt ? ` (alt: ${mdEscape(im.alt)})` : ""}`)
        ].join("\n")
      : "- _(žádné obrázky se nepodařilo stáhnout)_",
    ``,
    `**Top fonty (počty)**`,
    kvBullets(visual.typography?.fontsTop, 8),
    ``,
    `**Ukázky primárních buttonů**`,
    (visual.components?.primaryButtons || [])
      .slice(0, 8)
      .map((b) => {
        const parts = [
          b.text ? `“${mdEscape(b.text)}”` : null,
          b.backgroundColor ? `bg=${mdEscape(b.backgroundColor)}` : null,
          b.color ? `fg=${mdEscape(b.color)}` : null,
          b.borderRadius ? `radius=${mdEscape(b.borderRadius)}` : null,
          b.fontFamily ? `font=${mdEscape(b.fontFamily)}` : null
        ].filter(Boolean);
        return `- ${parts.join(" · ")} (${mdEscape(b.url)})`;
      })
      .join("\n") || "- _(nenalezeno)_",
    ``,
    `### Tvůj úkol (vrať přesně tento formát)`,
    ``,
    `Vrať výstup jako **validní JSON** v následující struktuře (bez dalších komentářů):`,
    ``,
    "```json\n{\n  \"strategy\": {\n    \"positioning\": \"...\",\n    \"primaryMessage\": \"...\",\n    \"secondaryMessages\": [\"...\"],\n    \"targetSegments\": [\"...\"],\n    \"trustProof\": [\"...\"],\n    \"conversionGoal\": \"...\"\n  },\n  \"informationArchitecture\": {\n    \"sitemap\": [\n      { \"path\": \"/\", \"title\": \"Home\", \"goal\": \"...\", \"sections\": [\"...\"] },\n      { \"path\": \"/services\", \"title\": \"Služby\", \"goal\": \"...\", \"sections\": [\"...\"] },\n      { \"path\": \"/pricing\", \"title\": \"Ceník\", \"goal\": \"...\", \"sections\": [\"...\"] },\n      { \"path\": \"/case-studies\", \"title\": \"Reference\", \"goal\": \"...\", \"sections\": [\"...\"] },\n      { \"path\": \"/about\", \"title\": \"O nás\", \"goal\": \"...\", \"sections\": [\"...\"] },\n      { \"path\": \"/contact\", \"title\": \"Kontakt\", \"goal\": \"...\", \"sections\": [\"...\"] }\n    ],\n    \"navigation\": {\n      \"primary\": [\"/\", \"/services\", \"/pricing\", \"/case-studies\", \"/about\", \"/contact\"],\n      \"cta\": { \"label\": \"...\", \"path\": \"/contact\" }\n    }\n  },\n  \"designSystem\": {\n    \"theme\": \"light|dark|mixed\",\n    \"colorTokens\": {\n      \"brandPrimary\": \"...\",\n      \"brandSecondary\": \"...\",\n      \"textPrimary\": \"...\",\n      \"bgPrimary\": \"...\",\n      \"surface\": \"...\",\n      \"border\": \"...\",\n      \"success\": \"...\",\n      \"danger\": \"...\"\n    },\n    \"typography\": {\n      \"fontFamilyBase\": \"...\",\n      \"fontFamilyHeading\": \"...\",\n      \"scale\": {\n        \"h1\": \"...\",\n        \"h2\": \"...\",\n        \"body\": \"...\"\n      }\n    },\n    \"components\": {\n      \"buttonPrimary\": { \"bg\": \"...\", \"fg\": \"...\", \"radius\": \"...\", \"hover\": \"...\" },\n      \"buttonSecondary\": { \"bg\": \"...\", \"fg\": \"...\", \"radius\": \"...\" },\n      \"card\": { \"bg\": \"...\", \"border\": \"...\", \"radius\": \"...\" }\n    }\n  },\n  \"copy\": {\n    \"voiceGuidelines\": [\"...\"],\n    \"home\": {\n      \"hero\": { \"headline\": \"...\", \"subheadline\": \"...\", \"primaryCta\": \"...\", \"secondaryCta\": \"...\" },\n      \"sections\": [\n        { \"name\": \"...\", \"headline\": \"...\", \"bullets\": [\"...\"], \"cta\": \"...\" }\n      ]\n    }\n  },\n  \"seo\": {\n    \"titleTemplates\": { \"home\": \"...\", \"services\": \"...\" },\n    \"metaDescriptionTemplates\": { \"home\": \"...\", \"services\": \"...\" }\n  },\n  \"implementationNotes\": {\n    \"frameworkSuggestion\": \"...\",\n    \"componentsToBuild\": [\"...\"],\n    \"analyticsEvents\": [\"...\"],\n    \"forms\": [ { \"name\": \"Kontakt\", \"fields\": [\"name\", \"email\", \"message\"], \"submitLabel\": \"...\" } ]\n  }\n}\n```",
    ``,
    `### Evidence (výřezy obsahu)`,
    `Použij níže uvedené výřezy jako důkaz / zdroj copy. Neukládej citlivé údaje.`,
    ``,
    ...evidencePages.flatMap((p) => {
      const blocks = (p.importantTextBlocks || []).slice(0, 8);
      const md = p.mainMarkdown ? p.mainMarkdown.slice(0, 1800) : null;
      return [
        `#### ${mdEscape(p.url)}`,
        p.meta?.title ? `- title: ${mdEscape(p.meta.title)}` : `- title: —`,
        p.h1 ? `- h1: ${mdEscape(p.h1)}` : `- h1: —`,
        ``,
        `**Text blocks:**`,
        blocks.length ? blocks.map((b) => `- ${mdEscape(b)}`).join("\n") : "- _(nenalezeno)_",
        md ? `\n**Main markdown (výřez):**\n\n${md}\n` : ``,
        ``
      ].filter((x) => x !== "");
    }),
    ``
  ].join("\n");
}

