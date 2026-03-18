function takeUnique(arr, n) {
  const out = [];
  const seen = new Set();
  for (const x of arr || []) {
    const k = String(x || "").toLowerCase();
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(x);
    if (out.length >= n) break;
  }
  return out;
}

export function summarizeSite({ crawl, brand, visual }) {
  const okPages = (crawl.pages || []).filter((p) => !p.error);

  const titles = okPages.map((p) => p.meta?.title).filter(Boolean);
  const h1s = okPages.map((p) => p.h1).filter(Boolean);

  const keyPages = okPages
    .map((p) => ({
      url: p.url,
      title: p.meta?.title || null,
      h1: p.h1 || null,
      status: p.status ?? null
    }))
    .slice(0, 15);

  const topClaims = (brand.brand?.claimCandidates || []).slice(0, 6).map((x) => x.text);
  const topCtas = (brand.conversion?.primaryCtas || []).slice(0, 6).map((x) => x.text);

  return {
    siteNameGuess: takeUnique(brand.brand?.nameCandidates || [], 1)[0] || null,
    languageGuess: brand.voice?.languageGuess || "unknown",
    toneGuess: brand.voice?.tone || "unknown",
    primaryClaims: topClaims,
    primaryCtas: topCtas,
    offerSummary: {
      services: takeUnique(brand.offer?.servicesCandidates || [], 10),
      products: takeUnique(brand.offer?.productsCandidates || [], 10),
      industries: takeUnique(brand.offer?.industriesCandidates || [], 8)
    },
    visualSummary: {
      theme: visual.themeGuess,
      topFonts: (visual.typography?.fontsTop || []).slice(0, 5).map((f) => f.value),
      palette: {
        text: (visual.palette?.textColors || []).slice(0, 6).map((c) => c.value),
        background: (visual.palette?.backgroundColors || []).slice(0, 6).map((c) => c.value),
        border: (visual.palette?.borderColors || []).slice(0, 6).map((c) => c.value)
      }
    },
    evidence: {
      sampleTitles: takeUnique(titles, 10),
      sampleH1s: takeUnique(h1s, 10),
      keyPages
    }
  };
}

