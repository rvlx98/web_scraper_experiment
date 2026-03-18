function topN(items, n) {
  return (items || []).slice(0, n);
}

function mergeTopCounts(pages, key, n = 10) {
  const map = new Map(); // value -> count
  for (const p of pages) {
    const arr = p.visual?.[key] || [];
    for (const it of arr) {
      if (!it?.value) continue;
      map.set(it.value, (map.get(it.value) || 0) + (it.count || 1));
    }
  }
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([value, count]) => ({ value, count }));
}

function mergeFonts(pages) {
  return mergeTopCounts(pages, "topFonts", 10);
}

function pickPrimaryButtonStyles(pages) {
  const samples = [];
  for (const p of pages) {
    for (const b of p.visual?.primaryButtons || []) {
      if (!b) continue;
      if (!b.backgroundColor && !b.borderColor) continue;
      samples.push({
        url: p.url,
        text: b.text,
        backgroundColor: b.backgroundColor,
        color: b.color,
        borderColor: b.borderColor,
        borderRadius: b.borderRadius,
        fontFamily: b.fontFamily,
        fontWeight: b.fontWeight,
        textTransform: b.textTransform
      });
    }
  }
  return samples.slice(0, 20);
}

function guessTheme(pages) {
  const bgs = mergeTopCounts(pages, "topBackgroundColors", 6).map((x) => x.value);
  const hasDark = bgs.some((c) => /rgb\(\s*(0|1|2|3)\s*,\s*(0|1|2|3)\s*,\s*(0|1|2|3)\s*\)/.test(c) || /#0/i.test(c));
  const hasLight = bgs.some((c) => /rgb\(\s*2[0-5]\d\s*,\s*2[0-5]\d\s*,\s*2[0-5]\d\s*\)/.test(c) || /#f/i.test(c));
  if (hasDark && !hasLight) return "dark";
  if (hasLight && !hasDark) return "light";
  if (hasDark && hasLight) return "mixed";
  return "unknown";
}

export function analyzeVisualStyle(crawl) {
  const okPages = (crawl.pages || []).filter((p) => !p.error && p.visual);

  const palette = {
    textColors: mergeTopCounts(okPages, "topTextColors", 10),
    backgroundColors: mergeTopCounts(okPages, "topBackgroundColors", 10),
    borderColors: mergeTopCounts(okPages, "topBorderColors", 8)
  };

  const fonts = mergeFonts(okPages);
  const theme = guessTheme(okPages);
  const buttons = pickPrimaryButtonStyles(okPages);
  const layoutHints = okPages
    .map((p) => p.visual?.layout)
    .filter(Boolean)
    .slice(0, 10);

  const logos = okPages.flatMap((p) => (p.visual?.logoCandidates || []).map((l) => ({ url: p.url, ...l }))).slice(0, 15);

  return {
    themeGuess: theme,
    palette,
    typography: {
      fontsTop: fonts
    },
    components: {
      primaryButtons: buttons
    },
    brandAssets: {
      logoCandidates: logos
    },
    layoutHints
  };
}

