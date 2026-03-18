import { z } from "zod";
import { crawlSite } from "./crawlSite.js";
import { analyzeBrandAndOffer } from "./signals/analyzeBrandAndOffer.js";
import { analyzeVisualStyle } from "./signals/analyzeVisualStyle.js";
import { summarizeSite } from "./summarizeSite.js";
import { renderAgentPromptMarkdown } from "./renderAgentPromptMarkdown.js";
import crypto from "node:crypto";
import { downloadAssets } from "./assets/downloadAssets.js";

const AnalyzeInputSchema = z.object({
  url: z.string().min(1),
  maxPages: z.number().int().min(1).max(40),
  maxDepth: z.number().int().min(0).max(5),
  timeoutMsPerPage: z.number().int().min(2000).max(90000),
  allowExternalAssets: z.boolean()
});

export async function analyzeWebsite(input) {
  const cfg = AnalyzeInputSchema.parse(input);

  const crawl = await crawlSite(cfg);

  const brand = analyzeBrandAndOffer(crawl);
  const visual = analyzeVisualStyle(crawl);
  const summary = summarizeSite({ crawl, brand, visual });

  const runId = crypto.randomUUID();

  const base = {
    meta: {
      analyzer: "ai-web-analyst-mvp",
      version: "0.1.0",
      analyzedAt: new Date().toISOString(),
      runId
    },
    input: cfg,
    crawl: {
      rootUrl: crawl.rootUrl,
      normalizedRoot: crawl.normalizedRoot,
      robots: crawl.robots,
      stats: crawl.stats,
      pages: crawl.pages
    },
    brand,
    visual,
    summary,
    agent: {
      purpose: "prompt_for_website_redesign_agent",
      promptMarkdown: ""
    },
    assets: null
  };

  // Collect image candidates across pages and download a small pack for the next agent.
  const imageCandidates = (crawl.pages || [])
    .filter((p) => !p.error)
    .flatMap((p) => (p.images || []).map((img) => ({ ...img, pageUrl: p.url })));

  base.assets = await downloadAssets({
    runId,
    rootUrl: crawl.rootUrl,
    imageCandidates,
    maxImages: 30
  });

  base.agent.promptMarkdown = renderAgentPromptMarkdown(base);
  return base;
}

