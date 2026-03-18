// Tiny, dependency-free-ish sniff (enough for MVP images).
export async function fileTypeFromBuffer(buf) {
  if (!buf || buf.length < 12) return null;
  const b = buf;
  // PNG
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return { ext: "png", mime: "image/png" };
  // JPG
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { ext: "jpg", mime: "image/jpeg" };
  // GIF
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return { ext: "gif", mime: "image/gif" };
  // WEBP
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50)
    return { ext: "webp", mime: "image/webp" };
  // SVG (best-effort)
  const head = b.slice(0, 200).toString("utf8").toLowerCase();
  if (head.includes("<svg")) return { ext: "svg", mime: "image/svg+xml" };
  return null;
}

