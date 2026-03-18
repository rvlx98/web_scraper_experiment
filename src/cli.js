import { analyzeWebsite } from "./web/analyzeWebsite.js";
import { renderReportMarkdown } from "./web/renderReportMarkdown.js";

const url = process.argv[2];
if (!url) {
  // eslint-disable-next-line no-console
  console.error("Usage: npm run cli -- <url>");
  process.exit(1);
}

const maxPages = Number(process.env.MAX_PAGES || "12");
const maxDepth = Number(process.env.MAX_DEPTH || "2");

const result = await analyzeWebsite({ url, maxPages, maxDepth, timeoutMsPerPage: 25000, allowExternalAssets: true });
// eslint-disable-next-line no-console
console.log(JSON.stringify(result, null, 2));
// eslint-disable-next-line no-console
console.error("\n---\nMarkdown report:\n");
// eslint-disable-next-line no-console
console.error(renderReportMarkdown(result));

