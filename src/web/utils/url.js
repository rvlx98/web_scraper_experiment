export function toCanonicalUrl(raw) {
  if (!raw) return null;
  try {
    const u = raw instanceof URL ? raw : new URL(String(raw));
    u.hash = "";
    // normalize tracking-ish params minimally (MVP)
    const drop = new Set(["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "gclid", "fbclid"]);
    for (const k of [...u.searchParams.keys()]) {
      if (drop.has(k.toLowerCase())) u.searchParams.delete(k);
    }
    // keep trailing slash as-is (some sites use it); Playwright will follow canonical anyway
    return u.toString();
  } catch {
    return null;
  }
}

export function getSameOrigin(url) {
  const u = new URL(url);
  return u.origin;
}

export function classifyUrlPriority(u) {
  const p = (u.pathname || "/").toLowerCase();
  const q = u.search ? 0.5 : 0;
  let score = 1 - q;

  // High-signal pages for brand/offer
  const boost = [
    ["/", 8],
    ["about", 6],
    ["o-nas", 6],
    ["team", 4],
    ["kontakt", 6],
    ["contact", 6],
    ["pricing", 7],
    ["cenik", 7],
    ["price", 7],
    ["sluzby", 7],
    ["services", 7],
    ["produkty", 6],
    ["products", 6],
    ["case", 6],
    ["reference", 6],
    ["portfolio", 6],
    ["blog", 3],
    ["privacy", 2],
    ["gdpr", 2],
    ["terms", 2]
  ];
  for (const [key, add] of boost) {
    if (key === "/" && p === "/") score += add;
    else if (key !== "/" && p.includes(key)) score += add;
  }

  // Deprioritize common low-signal stuff
  const deboost = ["wp-json", "xmlrpc", "feed", "tag/", "category/", "author/", "search", "login", "cart", "checkout"];
  for (const key of deboost) if (p.includes(key)) score -= 3;

  return score;
}

