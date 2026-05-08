import ExcelJS from "exceljs";
import { classifyPageText, CLASS_LABELS } from "./classifyPageText.js";
import { fetchTextsForUrlsPooled } from "./fetchPageText.js";
import { chromium } from "playwright";
import { collectAktivacexUrlCells } from "./extractUrlsFromWorkbook.js";

/** Výchozí a zároveň spodní hranice proti starému env AKTIVACEX_MAX_URLS=400. */
const MIN_EFFECTIVE_DISTINCT_URLS = 2500;
const MIN_EFFECTIVE_CELL_REFS = 25000;

const GREEN = "FFC6EFCE"; // light green
const RED = "FFFFC7CE"; // light red
const AMBER = "FFFFEB9C"; // other / error hint

/**
 * @param {{ ok: boolean, text: string, error: string | null }} r
 * @returns {{ kind: 'welcome' | 'unauthorized' | 'other', note: string }}
 */
function deriveKindFromFetchResult(r) {
  if (!r.ok) {
    return { kind: "other", note: r.error || "Chyba načtení" };
  }
  const kind = classifyPageText(r.text);
  const note = kind === "other" ? "Text neobsahuje očekávané fráze." : "";
  return { kind, note };
}

/**
 * @param {string[]} uniqueUrls
 * @param {Map<string, { ok: boolean, text: string, error: string | null }>} byUrl
 */
function buildSortedUniqueUrlsByKind(uniqueUrls, byUrl) {
  /** @type {string[]} */
  const welcome = [];
  /** @type {string[]} */
  const unauthorized = [];
  /** @type {string[]} */
  const other = [];
  const sorted = [...uniqueUrls].sort((a, b) => a.localeCompare(b, "cs"));
  for (const url of sorted) {
    const r = byUrl.get(url) || {
      ok: false,
      text: "",
      error: "Interní chyba mapování URL"
    };
    const { kind } = deriveKindFromFetchResult(r);
    if (kind === "welcome") welcome.push(url);
    else if (kind === "unauthorized") unauthorized.push(url);
    else other.push(url);
  }
  return { welcome, unauthorized, other };
}

/**
 * List s hodnotami v A/B/C podle uživatelem požadovaných barev; první záložka (orderNo).
 * @param {import('exceljs').Workbook} workbook
 * @param {string} originalSheetName
 * @param {{ welcome: string[], unauthorized: string[], other: string[] }} buckets
 */
function addRozrazeniLinksSheet(workbook, originalSheetName, buckets) {
  let sheetName = "Rozřazení odkazů";
  let n = 2;
  while (workbook.getWorksheet(sheetName)) {
    sheetName = `Rozřazení odkazů (${n++})`;
  }
  const sw = workbook.addWorksheet(sheetName);

  let minOther = Infinity;
  workbook.eachSheet((s) => {
    if (s.id !== sw.id) minOther = Math.min(minOther, s.orderNo);
  });
  sw.orderNo = Number.isFinite(minOther) ? minOther - 1 : 0;

  sw.mergeCells(1, 1, 1, 3);
  sw.getCell(1, 1).value = `Jedinečné odkazy ve sloupcích A / B / C podle výsledku. Původní tabulka se zabarvenými buňkami zůstává na listu „${originalSheetName}“.`;
  sw.getCell(1, 1).font = { italic: true, color: { argb: "FF555555" } };
  sw.getCell(1, 1).alignment = { vertical: "middle", wrapText: true };

  sw.getCell(2, 1).value = "A — Dobrý den / Dobré odpoledne (zelené)";
  sw.getCell(2, 2).value = "B — Neoprávněný přístup (červené)";
  sw.getCell(2, 3).value = "C — Ostatní / chyba (žluté)";
  for (let col = 1; col <= 3; col++) {
    sw.getCell(2, col).font = { bold: true };
  }

  const spec = [
    { urls: buckets.welcome, fill: GREEN, col: 1 },
    { urls: buckets.unauthorized, fill: RED, col: 2 },
    { urls: buckets.other, fill: AMBER, col: 3 }
  ];
  for (const { urls, fill, col } of spec) {
    let row = 3;
    for (const url of urls) {
      const cell = sw.getRow(row).getCell(col);
      cell.value = { text: url, hyperlink: url };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: fill }
      };
      row++;
    }
  }

  sw.getColumn(1).width = 72;
  sw.getColumn(2).width = 72;
  sw.getColumn(3).width = 72;
}

/**
 * Reads a finite positive integer from env, otherwise `fallback`.
 * @param {string | undefined} raw
 * @param {number} fallback
 */
function parseEnvPositiveInt(raw, fallback) {
  const n = Number(typeof raw === "string" ? raw.trim() : raw);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.floor(n);
}

/** Aktuální efektivní limity (pro log / konzistenci s kontrolou souboru). */
export function getResolvedAktivacexLimits() {
  return {
    maxDistinctUrls: Math.max(
      MIN_EFFECTIVE_DISTINCT_URLS,
      parseEnvPositiveInt(process.env.AKTIVACEX_MAX_URLS, MIN_EFFECTIVE_DISTINCT_URLS)
    ),
    maxCellsWithLinks: Math.max(
      MIN_EFFECTIVE_CELL_REFS,
      parseEnvPositiveInt(process.env.AKTIVACEX_MAX_CELLS, MIN_EFFECTIVE_CELL_REFS)
    ),
    fetchConcurrency: Math.max(
      1,
      Math.min(parseEnvPositiveInt(process.env.AKTIVACEX_CONCURRENCY, 6), 12)
    )
  };
}

/**
 * @param {Buffer} fileBuffer
 * @param {{ timeoutMsPerUrl?: number, concurrency?: number, onProgress?: (p: { stage: string, current?: number, total?: number, message?: string }) => void }} options
 */
export async function processAktivacexXlsxBuffer(fileBuffer, options = {}) {
  const timeoutMsPerUrl = options.timeoutMsPerUrl ?? 25000;
  const onProgress = options.onProgress;

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(fileBuffer);

  const sheet = workbook.worksheets[0];
  if (!sheet) {
    throw new Error("Excel neobsahuje žádný list.");
  }

  let cells = collectAktivacexUrlCells(sheet, { requireAktivacex: true });
  if (cells.length === 0) {
    cells = collectAktivacexUrlCells(sheet, { requireAktivacex: false });
  }
  if (cells.length === 0) {
    throw new Error("V souboru nebyly nalezeny žádné URL (zkontrolujte hypertextové odkazy nebo text začínající https://).");
  }

  const urls = cells.map((c) => c.url);
  const uniqueUrls = [...new Set(urls)];

  const resolved = getResolvedAktivacexLimits();
  const concurrency = Math.max(1, Math.min(options.concurrency ?? resolved.fetchConcurrency, 12));

  if (uniqueUrls.length > resolved.maxDistinctUrls) {
    throw new Error(
      `Příliš mnoho různých adres (${uniqueUrls.length}). Limit je ${resolved.maxDistinctUrls} jedinečných URL. Buď počet zúžeťte, nebo nastavte proměnnou AKTIVACEX_MAX_URLS.`
    );
  }
  if (cells.length > resolved.maxCellsWithLinks) {
    throw new Error(
      `Tabulka obsahuje příliš mnoho buněk s odkazy (${cells.length}). Limit je ${resolved.maxCellsWithLinks} (zahrnuje i opakování téže adresy na více řádcích). Zvyšte AKTIVACEX_MAX_CELLS nebo zúžte opakování ve sloupci.`
    );
  }

  onProgress?.({
    stage: "fetch",
    current: 0,
    total: uniqueUrls.length,
    message: "Stahuji stránky…"
  });

  const browser = await chromium.launch({ headless: true });
  try {
    const byUrl = await fetchTextsForUrlsPooled(browser, uniqueUrls, {
      timeoutMsPerUrl,
      concurrency,
      onProgress
    });

    const texts = urls.map((u) => byUrl.get(u) || { ok: false, text: "", error: "Interní chyba mapování URL" });

    const buckets = buildSortedUniqueUrlsByKind(uniqueUrls, byUrl);
    addRozrazeniLinksSheet(workbook, sheet.name, buckets);

    const lastCol = Math.max(1, ...cells.map((c) => c.col));
    const statusCol = lastCol + 1;
    const detailCol = lastCol + 2;

    sheet.getRow(1).getCell(statusCol).value = "Výsledek kontroly";
    sheet.getRow(1).getCell(detailCol).value = "Poznámka / chyba";

    for (let i = 0; i < cells.length; i++) {
      const { row, col } = cells[i];
      const cell = sheet.getRow(row).getCell(col);
      const r = texts[i];

      const { kind, note } = deriveKindFromFetchResult(r);

      if (kind === "unauthorized") {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: RED } };
      } else if (kind === "welcome") {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: GREEN } };
      } else {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: AMBER }
        };
      }

      sheet.getRow(row).getCell(statusCol).value = CLASS_LABELS[kind] || kind;
      sheet.getRow(row).getCell(detailCol).value = note;
    }

    onProgress?.({ stage: "done", message: "Hotovo." });

    const out = await workbook.xlsx.writeBuffer();
    return Buffer.from(out);
  } finally {
    await browser.close();
  }
}
