import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { analyzeWebsite } from "./web/analyzeWebsite.js";
import { renderReportMarkdown } from "./web/renderReportMarkdown.js";
import { renderAgentPromptMarkdown } from "./web/renderAgentPromptMarkdown.js";
import { renderInsightsMarkdown } from "./web/renderInsightsMarkdown.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: "2mb" }));

const JOBS = new Map(); // id -> { status, startedAt, finishedAt, error, result }
let jobSeq = 0;

const AnalyzeRequestSchema = z.object({
  url: z.string().min(1),
  maxPages: z.number().int().min(1).max(40).optional().default(12),
  maxDepth: z.number().int().min(0).max(5).optional().default(2),
  timeoutMsPerPage: z.number().int().min(2000).max(90000).optional().default(25000),
  allowExternalAssets: z.boolean().optional().default(true)
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "ui", "index.html"));
});

app.get("/health", (req, res) => res.json({ ok: true }));

// Expose downloaded assets for demo usage (MVP).
app.use("/reports", express.static(path.join(process.cwd(), "reports")));

app.post("/api/analyze", async (req, res) => {
  const parsed = AnalyzeRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
  }

  const id = String(++jobSeq);
  JOBS.set(id, { id, status: "queued", startedAt: Date.now(), finishedAt: null, error: null, result: null });
  res.status(202).json({ id });

  (async () => {
    const job = JOBS.get(id);
    if (!job) return;
    job.status = "running";
    try {
      const result = await analyzeWebsite(parsed.data);
      job.result = result;
      job.status = "succeeded";
      job.finishedAt = Date.now();
    } catch (e) {
      job.status = "failed";
      job.finishedAt = Date.now();
      job.error = e?.stack || String(e);
    }
  })();
});

app.get("/api/jobs/:id", (req, res) => {
  const job = JOBS.get(req.params.id);
  if (!job) return res.status(404).json({ error: "Not found" });
  res.json({ ...job, result: job.result ? { summary: job.result.summary } : null });
});

app.get("/api/jobs/:id/report.json", (req, res) => {
  const job = JOBS.get(req.params.id);
  if (!job) return res.status(404).json({ error: "Not found" });
  if (job.status !== "succeeded") return res.status(409).json({ error: "Job not succeeded", status: job.status });
  res.json(job.result);
});

app.get("/api/jobs/:id/report.md", (req, res) => {
  const job = JOBS.get(req.params.id);
  if (!job) return res.status(404).send("Not found");
  if (job.status !== "succeeded") return res.status(409).send(`Job not succeeded: ${job.status}`);
  const md = renderReportMarkdown(job.result);
  res.setHeader("content-type", "text/markdown; charset=utf-8");
  res.send(md);
});

app.get("/api/jobs/:id/insights.md", (req, res) => {
  const job = JOBS.get(req.params.id);
  if (!job) return res.status(404).send("Not found");
  if (job.status !== "succeeded") return res.status(409).send(`Job not succeeded: ${job.status}`);
  const md = renderInsightsMarkdown(job.result);
  res.setHeader("content-type", "text/markdown; charset=utf-8");
  res.send(md);
});

app.get("/api/jobs/:id/report.prompt.md", (req, res) => {
  const job = JOBS.get(req.params.id);
  if (!job) return res.status(404).send("Not found");
  if (job.status !== "succeeded") return res.status(409).send(`Job not succeeded: ${job.status}`);
  const md = job.result?.agent?.promptMarkdown || renderAgentPromptMarkdown(job.result);
  res.setHeader("content-type", "text/markdown; charset=utf-8");
  res.send(md);
});

app.use("/static", express.static(path.join(__dirname, "ui")));

const port = Number(process.env.PORT || 3000);
app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`AI web analyst MVP listening on http://localhost:${port}`);
});

