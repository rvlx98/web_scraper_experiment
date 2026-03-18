import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { fileTypeFromBuffer } from "./fileTypeSniff.js";

function safeExtFromUrl(u) {
  try {
    const p = new URL(u).pathname;
    const ext = path.extname(p).toLowerCase();
    if (!ext) return null;
    if (ext.length > 6) return null;
    return ext;
  } catch {
    return null;
  }
}

function sanitizeFilename(name) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 80);
}

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

export async function downloadAssets({
  runId,
  rootUrl,
  imageCandidates,
  maxImages = 30,
  maxBytesPerImage = 3_500_000
}) {
  const baseDir = path.join(process.cwd(), "reports", runId, "assets");
  await ensureDir(baseDir);

  const out = [];
  const seen = new Set();

  const prioritized = [...(imageCandidates || [])]
    .filter((x) => x?.url)
    .sort((a, b) => (b.priority || 0) - (a.priority || 0));

  for (const img of prioritized) {
    if (out.length >= maxImages) break;
    const url = img.url;
    if (seen.has(url)) continue;
    seen.add(url);

    let buf = null;
    let contentType = null;
    let status = null;
    try {
      const r = await fetch(url, { redirect: "follow" });
      status = r.status;
      if (!r.ok) continue;
      contentType = r.headers.get("content-type");
      const ab = await r.arrayBuffer();
      if (ab.byteLength > maxBytesPerImage) continue;
      buf = Buffer.from(ab);
    } catch {
      continue;
    }

    const sniff = await fileTypeFromBuffer(buf);
    const ext =
      (sniff?.ext ? `.${sniff.ext}` : null) ||
      safeExtFromUrl(url) ||
      (contentType?.includes("png") ? ".png" : null) ||
      (contentType?.includes("jpeg") ? ".jpg" : null) ||
      (contentType?.includes("webp") ? ".webp" : null) ||
      ".bin";

    const hash = crypto.createHash("sha1").update(buf).digest("hex").slice(0, 10);
    const base = sanitizeFilename(img.suggestedName || img.alt || "image");
    const filename = `${base}-${hash}${ext}`;
    const absPath = path.join(baseDir, filename);
    await fs.writeFile(absPath, buf);

    out.push({
      sourceUrl: url,
      pageUrl: img.pageUrl || null,
      alt: img.alt || null,
      kind: img.kind || "image",
      status,
      bytes: buf.byteLength,
      contentType: contentType || sniff?.mime || null,
      file: {
        name: filename,
        absPath,
        publicPath: `/reports/${runId}/assets/${filename}`
      }
    });
  }

  return {
    runId,
    rootUrl,
    dir: {
      absPath: path.join(process.cwd(), "reports", runId),
      publicPath: `/reports/${runId}`
    },
    images: out
  };
}

