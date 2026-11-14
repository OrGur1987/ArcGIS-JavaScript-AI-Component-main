export interface PdfPageImage {
  jpeg: Uint8Array;
  width: number;
  height: number;
}

/**
 * Minimal multi-page PDF writer: each page is one JPEG filling the page (A4-landscape width,
 * height follows the image aspect ratio). Text is drawn onto the canvas first (the browser
 * shapes Hebrew/RTL correctly), so no PDF font embedding is needed.
 */
export function jpegsToPdf(pages: PdfPageImage[]): Uint8Array {
  const pageW = 842;
  const enc = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [];
  let length = 0;
  const push = (data: Uint8Array | string) => {
    const bytes = typeof data === "string" ? enc.encode(data) : data;
    chunks.push(bytes);
    length += bytes.length;
  };
  const obj = (n: number, body: () => void) => {
    offsets[n] = length;
    push(`${n} 0 obj\n`);
    body();
    push("\nendobj\n");
  };

  // Object ids: 1 catalog, 2 page tree, then per page i: 3+3i page, 4+3i image, 5+3i content
  const pageId = (i: number) => 3 + 3 * i;
  push("%PDF-1.4\n");
  obj(1, () => push("<< /Type /Catalog /Pages 2 0 R >>"));
  obj(2, () => {
    const kids = pages.map((_, i) => `${pageId(i)} 0 R`).join(" ");
    push(`<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>`);
  });
  pages.forEach((pg, i) => {
    const pageH = Math.round((pageW * pg.height) / pg.width);
    obj(pageId(i), () =>
      push(
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} ${pageH}] ` +
          `/Resources << /XObject << /Im0 ${pageId(i) + 1} 0 R >> >> /Contents ${pageId(i) + 2} 0 R >>`,
      ),
    );
    obj(pageId(i) + 1, () => {
      push(
        `<< /Type /XObject /Subtype /Image /Width ${pg.width} /Height ${pg.height} ` +
          `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${pg.jpeg.length} >>\nstream\n`,
      );
      push(pg.jpeg);
      push("\nendstream");
    });
    const content = `q ${pageW} 0 0 ${pageH} 0 0 cm /Im0 Do Q`;
    obj(pageId(i) + 2, () => push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`));
  });

  const total = 3 + 3 * pages.length;
  const xrefAt = length;
  push(`xref\n0 ${total}\n0000000000 65535 f \n`);
  for (let n = 1; n < total; n++) push(`${String(offsets[n]).padStart(10, "0")} 00000 n \n`);
  push(`trailer\n<< /Size ${total} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF`);

  const out = new Uint8Array(length);
  let pos = 0;
  for (const c of chunks) {
    out.set(c, pos);
    pos += c.length;
  }
  return out;
}

export function downloadBytes(bytes: Uint8Array, filename: string, mime = "application/pdf"): void {
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

// ── Page composers (canvas, RTL) ─────────────────────────────────────────────

const FONT = "Arial, 'Segoe UI', sans-serif";
export const PAGE_W = 1600;
export const PAGE_H = 900;
/** Width / height of the map cards on page 2 (portrait). */
export const CARD_ASPECT = 0.8;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("טעינת צילום המפה נכשלה"));
    img.src = src;
  });
}

function makeCanvas(width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  ctx.direction = "rtl";
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  return { canvas, ctx };
}

async function toPage(canvas: HTMLCanvasElement): Promise<PdfPageImage> {
  const blob: Blob = await new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("יצירת התמונה נכשלה"))), "image/jpeg", 0.92),
  );
  return { jpeg: new Uint8Array(await blob.arrayBuffer()), width: canvas.width, height: canvas.height };
}

/** Draw `img` into the box, scaled to cover it and cropped around the centre. */
function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const scale = Math.max(w / img.width, h / img.height);
  const sw = w / scale;
  const sh = h / scale;
  ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, x, y, w, h);
}

/** Page like sketch page 2: the full-bleed map with a north arrow and the scale bar text. */
export async function composeMapPage(input: { title: string; screenshotDataUrl: string; scale: number }): Promise<PdfPageImage> {
  const img = await loadImage(input.screenshotDataUrl);
  const { canvas, ctx } = makeCanvas(PAGE_W, PAGE_H);
  drawCover(ctx, img, 0, 0, PAGE_W, PAGE_H);

  // Title tag (top right)
  ctx.font = `bold 34px ${FONT}`;
  const tw = ctx.measureText(input.title).width + 56;
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.fillRect(PAGE_W - 24 - tw, 24, tw, 62);
  ctx.fillStyle = "#0079c1";
  ctx.fillRect(PAGE_W - 24 - tw, 24, 8, 62);
  ctx.fillStyle = "#1b1b1b";
  ctx.fillText(input.title, PAGE_W - 24 - 28, 55);

  // North arrow (top left)
  ctx.save();
  ctx.fillStyle = "#000";
  ctx.font = `bold 34px serif`;
  ctx.textAlign = "center";
  ctx.fillText("N", 52, 38);
  ctx.beginPath();
  ctx.moveTo(52, 56);
  ctx.lineTo(70, 130);
  ctx.lineTo(52, 116);
  ctx.lineTo(34, 130);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Scale (bottom left)
  const scaleText = `1:${Math.round(input.scale / 100) * 100 || Math.round(input.scale)}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.fillRect(16, PAGE_H - 86, 190, 70);
  ctx.fillStyle = "#111";
  ctx.textAlign = "left";
  ctx.font = `26px ${FONT}`;
  ctx.fillText("קנה מידה", 28, PAGE_H - 62);
  ctx.fillText(scaleText, 28, PAGE_H - 32);

  return toPage(canvas);
}

export interface MapCard {
  title: string;
  /** null when the group does not exist in the map */
  screenshotDataUrl: string | null;
}

/** Page like sketch page 3: titled portrait map cards side by side, first card on the right. */
export async function composeCardsPage(cards: MapCard[]): Promise<PdfPageImage> {
  const { canvas, ctx } = makeCanvas(PAGE_W, PAGE_H);
  ctx.fillStyle = "#e1f3fc";
  ctx.fillRect(0, 0, PAGE_W, PAGE_H);

  const n = Math.max(cards.length, 1);
  const gap = 40;
  const cardW = Math.min(340, Math.floor((PAGE_W - 120 - gap * (n - 1)) / n));
  const cardH = Math.round(cardW / CARD_ASPECT);
  const totalW = cardW * n + gap * (n - 1);
  const left = (PAGE_W - totalW) / 2;
  const top = 250;

  for (const [i, card] of cards.entries()) {
    const x = left + totalW - cardW - i * (cardW + gap); // RTL: index 0 at the right
    ctx.fillStyle = "#111";
    ctx.textAlign = "center";
    ctx.font = `bold 34px ${FONT}`;
    ctx.fillText(card.title, x + cardW / 2, top - 44);

    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.35)";
    ctx.shadowBlur = 14;
    ctx.fillStyle = "#fff";
    ctx.fillRect(x, top, cardW, cardH);
    ctx.restore();

    if (card.screenshotDataUrl) {
      const img = await loadImage(card.screenshotDataUrl);
      drawCover(ctx, img, x, top, cardW, cardH);
    } else {
      ctx.fillStyle = "#777";
      ctx.font = `22px ${FONT}`;
      ctx.fillText("הקבוצה לא נמצאה במפה", x + cardW / 2, top + cardH / 2);
    }
  }
  return toPage(canvas);
}

export interface TableColumn {
  title: string;
  color: string;
}
export interface TableRow {
  label: string;
  /** one entry per column; "\n" separates lines */
  cells: string[];
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const out: string[] = [];
  for (const para of text.split("\n")) {
    let line = "";
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word;
      if (line && ctx.measureText(next).width > maxWidth) {
        out.push(line);
        line = word;
      } else {
        line = next;
      }
    }
    out.push(line);
  }
  return out;
}

/** Page like sketch page 5: footnotes, a zone-by-attribute table, then the notes line. */
export async function composeTablePage(input: {
  columns: TableColumn[];
  rows: TableRow[];
  topNotes: string[];
  bottomNotes: string[];
}): Promise<PdfPageImage> {
  const margin = 50;
  const labelW = 260;
  const colCount = Math.max(input.columns.length, 1);
  const colW = Math.floor((PAGE_W - margin * 2 - labelW) / colCount);
  const lineH = 28;
  const pad = 12;
  const font = `22px ${FONT}`;

  // Measure first so the page can grow with the content.
  const probe = makeCanvas(10, 10).ctx;
  probe.font = font;
  const rowHeights = input.rows.map((r) => {
    const lines = Math.max(
      wrapLines(probe, r.label, labelW - pad * 2).length,
      ...r.cells.map((c) => wrapLines(probe, c, colW - pad * 2).length),
    );
    return lines * lineH + pad * 2;
  });
  const headerH = 60;
  probe.font = `20px ${FONT}`;
  const notesH = (arr: string[]) =>
    arr.reduce((h, n) => h + wrapLines(probe, n, PAGE_W - margin * 2).length * 26, 0) + (arr.length ? 20 : 0);
  const topH = notesH(input.topNotes);
  const bottomH = notesH(input.bottomNotes);
  const tableH = headerH + rowHeights.reduce((a, b) => a + b, 0);
  const height = Math.max(PAGE_H, 100 + topH + tableH + bottomH + 60);

  const { canvas, ctx } = makeCanvas(PAGE_W, height);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, PAGE_W, height);

  let y = 50;
  ctx.fillStyle = "#222";
  ctx.font = `20px ${FONT}`;
  for (const note of input.topNotes) {
    for (const line of wrapLines(ctx, note, PAGE_W - margin * 2)) {
      ctx.fillText(line, PAGE_W - margin, y);
      y += 26;
    }
  }
  y += 20;

  const right = PAGE_W - margin;
  const cellX = (col: number) => right - labelW - (col + 1) * colW; // left edge of zone column `col`

  // Header row
  ctx.fillStyle = "#d9d9d9";
  ctx.fillRect(right - labelW, y, labelW, headerH);
  ctx.fillStyle = "#111";
  ctx.font = `bold 26px ${FONT}`;
  ctx.textAlign = "center";
  ctx.fillText("אזור ייעוד", right - labelW / 2, y + headerH / 2);
  input.columns.forEach((c, i) => {
    ctx.fillStyle = c.color;
    ctx.fillRect(cellX(i), y, colW, headerH);
    ctx.fillStyle = "#111";
    ctx.fillText(c.title, cellX(i) + colW / 2, y + headerH / 2, colW - pad * 2);
  });
  y += headerH;

  // Body
  ctx.font = font;
  input.rows.forEach((r, ri) => {
    const h = rowHeights[ri];
    ctx.fillStyle = "#f3f3f3";
    ctx.fillRect(right - labelW, y, labelW, h);
    ctx.strokeStyle = "#222";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(right - labelW, y, labelW, h);
    ctx.fillStyle = "#111";
    ctx.textAlign = "right";
    wrapLines(ctx, r.label, labelW - pad * 2).forEach((line, li) =>
      ctx.fillText(line, right - pad, y + pad + lineH / 2 + li * lineH),
    );
    r.cells.forEach((cell, ci) => {
      ctx.fillStyle = hexToTint(input.columns[ci]?.color ?? "#cccccc", 0.12);
      ctx.fillRect(cellX(ci), y, colW, h);
      ctx.strokeRect(cellX(ci), y, colW, h);
      ctx.fillStyle = "#111";
      wrapLines(ctx, cell, colW - pad * 2).forEach((line, li) =>
        ctx.fillText(line, cellX(ci) + colW - pad, y + pad + lineH / 2 + li * lineH),
      );
    });
    y += h;
  });

  // Bottom notes
  y += 30;
  ctx.fillStyle = "#222";
  ctx.font = `20px ${FONT}`;
  ctx.textAlign = "right";
  for (const note of input.bottomNotes) {
    for (const line of wrapLines(ctx, note, PAGE_W - margin * 2)) {
      ctx.fillText(line, PAGE_W - margin, y);
      y += 26;
    }
  }
  return toPage(canvas);
}

function hexToTint(hex: string, alpha: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return `rgba(200,200,200,${alpha})`;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}
