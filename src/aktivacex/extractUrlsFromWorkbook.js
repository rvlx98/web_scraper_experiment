const URL_IN_STRING = /https?:\/\/[^\s\])>'"]+/gi;

function normalizeUrl(raw) {
  if (!raw || typeof raw !== "string") return null;
  const t = raw.trim();
  if (!t) return null;
  const m = t.match(/https?:\/\/[^\s\])>'"]+/i);
  return m ? m[0] : null;
}

function valueToString(v) {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (typeof v === "object") {
    if (typeof v.text === "string") return v.text;
    if (typeof v.richText === "object" && Array.isArray(v.richText)) {
      return v.richText.map((p) => p.text || "").join("");
    }
    if (typeof v.hyperlink === "string" && v.hyperlink) return v.hyperlink;
  }
  return "";
}

/**
 * Extract hyperlink target from exceljs cell if present.
 * @param {import('exceljs').Cell} cell
 */
export function getCellUrl(cell) {
  if (!cell) return null;
  const hl = cell.hyperlink;
  if (typeof hl === "string" && /^https?:\/\//i.test(hl)) return hl;
  if (hl && typeof hl === "object") {
    const target = /** @type {{ target?: string }} */ (hl).target;
    if (typeof target === "string" && /^https?:\/\//i.test(target)) return target;
  }

  const v = cell.value;
  if (v && typeof v === "object" && typeof /** @type {{ hyperlink?: string }} */ (v).hyperlink === "string") {
    const u = /** @type {{ hyperlink: string }} */ (v).hyperlink;
    if (/^https?:\/\//i.test(u)) return u;
  }

  const s = valueToString(v);
  const fromText = normalizeUrl(s);
  if (fromText) return fromText;

  if (typeof v === "string") {
    const matches = v.match(URL_IN_STRING);
    if (matches?.[0]) return matches[0];
  }
  return null;
}

/**
 * @param {import('exceljs').Worksheet} sheet
 * @param {{ requireAktivacex?: boolean }} opts
 * @returns {{ row: number, col: number, url: string }[]}
 */
export function collectAktivacexUrlCells(sheet, opts = {}) {
  const requireAktivacex = opts.requireAktivacex !== false;
  /** @type {{ row: number, col: number, url: string }[]} */
  const out = [];
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      const url = getCellUrl(cell);
      if (!url) return;
      const lower = url.toLowerCase();
      if (requireAktivacex && !lower.includes("aktivacex")) return;
      out.push({ row: rowNumber, col: colNumber, url });
    });
  });
  return out;
}
