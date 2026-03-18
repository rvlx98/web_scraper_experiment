function norm(s) {
  return String(s || "")
    .replace(/\s+/g, " ")
    .trim();
}

function lower(s) {
  return norm(s).toLowerCase();
}

function scorePhrase(phrase) {
  const p = lower(phrase);
  let score = 1;
  if (!p) return 0;
  if (p.length >= 30 && p.length <= 120) score += 1.5; // typical claim length
  if (/[!?]/.test(p)) score += 0.5;
  if (/(zdarma|free|sleva|akce|garance|záruka|rychle|nej|top|premium)/.test(p)) score += 0.6;
  if (/(kontakt|rezerv|objedn|koupit|book|buy|call|demo|quote|cen|pricing)/.test(p)) score += 0.6;
  return score;
}

function topPhrases(phrases, limit = 12) {
  const map = new Map();
  for (const ph of phrases) {
    const t = norm(ph);
    if (!t) continue;
    const key = t.toLowerCase();
    map.set(key, (map.get(key) || 0) + scorePhrase(t));
  }
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([k, score]) => ({ text: k, score: Math.round(score * 10) / 10 }));
}

function guessLanguage(text) {
  const t = lower(text);
  if (!t) return "unknown";
  const czHits = [" a ", " je ", " jsme ", " vaše ", " pro ", " díky ", " nabíd", " služb", " kontakt"];
  const enHits = [" the ", " we ", " your ", " for ", " contact", " pricing", " services", " about"];
  let cz = 0;
  let en = 0;
  for (const h of czHits) if (t.includes(h)) cz++;
  for (const h of enHits) if (t.includes(h)) en++;
  if (cz > en) return "cs";
  if (en > cz) return "en";
  return "unknown";
}

function extractOfferCandidates(pages) {
  const buckets = {
    services: [],
    products: [],
    industries: [],
    promises: [],
    objections: [],
    pricing: []
  };

  for (const p of pages) {
    const path = (() => {
      try {
        return new URL(p.url).pathname.toLowerCase();
      } catch {
        return "";
      }
    })();

    const blocks = [...(p.importantTextBlocks || []), ...(p.headings || []).map((h) => h.text), p.h1].filter(Boolean);
    const all = blocks.map(norm).filter((t) => t.length >= 10 && t.length <= 220);

    for (const t of all) {
      const lt = lower(t);
      if (/(služb|services|řešení|solution|konzult|audit|implement|vývoj|development|design|marketing|seo|ppc)/.test(lt)) buckets.services.push(t);
      if (/(produkt|product|platform|app|aplikace|software|saas|nástroj|tool)/.test(lt)) buckets.products.push(t);
      if (/(e-?shop|b2b|b2c|startup|manufact|stroj|realit|health|finance|edu|škola)/.test(lt)) buckets.industries.push(t);
      if (/(garance|záruk|promise|rychle|do \d+ dn|do \d+ dní|24\/7|kvalit)/.test(lt)) buckets.promises.push(t);
      if (/(často|faq|otázk|question|obava|risk|bezpeč|security|vrácen|refund)/.test(lt)) buckets.objections.push(t);
      if (/(cen|pricing|od \d|kč|czk|€|eur|price|tarif|balíček|plan)/.test(lt) || path.includes("cenik") || path.includes("pricing"))
        buckets.pricing.push(t);
    }
  }

  const dedupe = (arr) => {
    const seen = new Set();
    const out = [];
    for (const x of arr) {
      const k = lower(x);
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(x);
    }
    return out;
  };

  for (const k of Object.keys(buckets)) buckets[k] = dedupe(buckets[k]).slice(0, 40);
  return buckets;
}

function extractTrustSignals(pages) {
  const items = [];
  const patterns = [
    /(recenze|reference|testimon|portfolio|case study|případová studie)/i,
    /(certifik|partner|google|meta|facebook|shopify|microsoft|aws)/i,
    /(IČO|DIČ|č\.?\s?účet|bank|sídlo|adresa)/i
  ];
  for (const p of pages) {
    const text = [...(p.importantTextBlocks || []), ...(p.headings || []).map((h) => h.text), p.h1].filter(Boolean).join(" | ");
    for (const pat of patterns) {
      const m = text.match(pat);
      if (m) items.push({ url: p.url, match: m[0] });
    }
  }
  // de-dupe
  const seen = new Set();
  const out = [];
  for (const it of items) {
    const k = `${it.match.toLowerCase()}::${it.url}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(it);
  }
  return out.slice(0, 30);
}

function extractVoice(pages) {
  const ctas = [];
  const headings = [];
  const blocks = [];
  const nav = [];
  for (const p of pages) {
    for (const c of p.ctas || []) if (c.text) ctas.push(c.text);
    for (const h of p.headings || []) if (h.text) headings.push(h.text);
    for (const b of p.importantTextBlocks || []) blocks.push(b);
    for (const l of p.navLinks || []) if (l.text) nav.push(l.text);
  }

  const allText = [...headings, ...blocks, ...nav].join(" ");
  const lang = guessLanguage(allText);

  const youFormality = (() => {
    const t = lower(allText);
    const ty = (t.match(/\bty\b/g) || []).length + (t.match(/\btvoje\b/g) || []).length;
    const vy = (t.match(/\bvy\b/g) || []).length + (t.match(/\bvaše\b/g) || []).length;
    if (ty === 0 && vy === 0) return "unknown";
    return vy >= ty ? "formal_or_neutral" : "informal";
  })();

  const tone = (() => {
    const t = lower(allText);
    const friendly = /(přátel|ahoj|zvládnem|pomůžem|společně|easy|simple)/.test(t);
    const corporate = /(profesion|strateg|komplex|enterprise|proces|governance|compliance)/.test(t);
    const bold = /(!{1,}|nejlepší|top|revolu|game-?changer|must-?have)/.test(t);
    if (corporate && !friendly) return "corporate";
    if (friendly && !corporate) return "friendly";
    if (bold) return "salesy_bold";
    return "neutral";
  })();

  return {
    languageGuess: lang,
    formality: youFormality,
    tone
  };
}

export function analyzeBrandAndOffer(crawl) {
  const okPages = (crawl.pages || []).filter((p) => !p.error && (p.status == null || (p.status >= 200 && p.status < 500)));

  const offerItems = okPages.flatMap((p) => (p.offerItems || []).map((it) => ({ ...it, pageUrl: p.url })));

  const brandNameCandidates = [];
  const sloganCandidates = [];
  const primaryValueCandidates = [];
  const ctaText = [];

  for (const p of okPages) {
    const title = p.meta?.title;
    const h1 = p.h1;
    if (title) brandNameCandidates.push(title.split("|")[0]?.trim());
    if (h1) sloganCandidates.push(h1);
    for (const h of p.headings || []) if (h.tag === "h2" || h.tag === "h3") primaryValueCandidates.push(h.text);
    for (const c of p.ctas || []) if (c.text) ctaText.push(c.text);
  }

  const offers = extractOfferCandidates(okPages);
  const trust = extractTrustSignals(okPages);
  const voice = extractVoice(okPages);

  const claims = topPhrases([...sloganCandidates, ...primaryValueCandidates, ...offers.promises], 14);
  const topCtas = topPhrases(ctaText, 12);

  return {
    brand: {
      nameCandidates: [...new Set(brandNameCandidates.filter(Boolean))].slice(0, 8),
      claimCandidates: claims,
      differentiatorsCandidates: topPhrases([...offers.services, ...offers.products, ...offers.promises], 12)
    },
    offer: {
      servicesCandidates: offers.services,
      productsCandidates: offers.products,
      industriesCandidates: offers.industries,
      pricingMentions: offers.pricing.slice(0, 20),
      items: offerItems.slice(0, 80)
    },
    conversion: {
      primaryCtas: topCtas,
      formsFound: okPages.flatMap((p) => (p.forms || []).map((f) => ({ url: p.url, method: f.method, action: f.action, fields: f.inputs?.slice(0, 12) || [] }))).slice(0, 15)
    },
    trust: {
      signals: trust,
      socialLinks: okPages.flatMap((p) => p.socialLinks || []).slice(0, 20)
    },
    voice
  };
}

