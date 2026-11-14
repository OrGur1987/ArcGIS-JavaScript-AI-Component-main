import { resolveArcgisMcpBaseUrl } from "./arcgisMcp";

/**
 * Master-plan (תא/5500) lookups through the MCP hub's TA5500 RAG server, parsed into the rows of
 * the planning-info table. The hub returns formatted Hebrew text, so the parsing here is
 * heuristic: anything it cannot find is reported as "—" rather than guessed.
 */

export interface ZoneInfo {
  zone: string;
  found: boolean;
  primaryUse: string;
  extraUses: string;
  far: string;
  height: string;
  directives: string;
  /** e.g. "סעיף 3.2.5, עמ׳ 27-28" */
  source: string;
}

export interface ZonePlanResult {
  info: ZoneInfo;
  /** Short notes from table 5.4 for the planning area (empty when no area code). */
  areaNotes: string[];
}

const NONE = "—";
let searchToolName: string | null = null;

async function hubRpc(method: string, params?: unknown): Promise<any> {
  const res = await fetch(resolveArcgisMcpBaseUrl(), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method, params }),
  });
  if (!res.ok) throw new Error(`שרת ה-MCP Hub החזיר ${res.status}`);
  const json = await res.json();
  if (json.error) throw new Error(json.error.message ?? "שגיאת MCP Hub");
  return json.result;
}

async function resolveSearchTool(): Promise<string> {
  if (searchToolName) return searchToolName;
  const result = await hubRpc("tools/list");
  const tool = (result?.tools ?? []).find((t: any) => /(^|__)search_plan$/.test(String(t.name)));
  if (!tool) throw new Error("כלי search_plan של ה-RAG לא נמצא ב-MCP Hub (האם שרת TA5500 פעיל?)");
  searchToolName = String(tool.name);
  return searchToolName;
}

async function searchPlan(args: Record<string, unknown>): Promise<string> {
  const name = await resolveSearchTool();
  const result = await hubRpc("tools/call", { name, arguments: args });
  const text = (result?.content ?? []).map((c: any) => c?.text ?? "").join("\n");
  if (result?.isError) throw new Error(text || "שגיאה בגישה ל-RAG");
  return text;
}

// ── Parsing ──────────────────────────────────────────────────────────────────

function splitHits(text: string): string[] {
  return text.split(/\n(?=\[\d+\] )/).filter((s) => /^\[\d+\] /.test(s));
}

function clip(s: string, max: number): string {
  const t = s.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  return cut.slice(0, Math.max(cut.lastIndexOf(" "), max - 20)) + "…";
}

function parseFar(text: string): string {
  const nums = [...text.matchAll(/רח["״”]ק\s*(?:בסיסי|מרבי)\s*:\s*(\d+(?:\.\d+)?)/g)].map((m) => Number(m[1]));
  if (nums.length === 0) {
    const single = /רח["״”]ק\s+(\d+(?:\.\d+)?)/.exec(text);
    return single ? single[1] : NONE;
  }
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  return min === max ? String(min) : `${min}-${max}`;
}

function parseHeight(text: string): string {
  if (/ללא\s+מגבלת\s+גובה/.test(text)) return "ללא מגבלת גובה";
  const m = /עד\s*(\d+)\s*קומות/.exec(text);
  return m ? `עד ${m[1]} קומות` : NONE;
}

function parseZoneHit(hit: string, zone: string): Omit<ZoneInfo, "zone"> {
  const [header, , ...rest] = hit.split("\n");
  const body = rest.join("\n");
  const section = /סעיף\s+([\d.]+)\s*\|\s*(עמוד(?:ים)?)\s+([\d-]+)/.exec(header);
  const source = section ? `סעיף ${section[1]}, עמ׳ ${section[3]}` : "";

  const primary = /מקבץ שימושים ראשי\s*[-–]\s*([^\n]+?)\.?\s*(?:\n|$)/.exec(body)?.[1] ?? NONE;

  let extra = NONE;
  const extraBlock = /\(2\)\s*מקבצי שימושים נוספים:?\s*\n([\s\S]*?)(?=\n\(3\)|\n\([א-ת]\)\s*שטחי|$)/.exec(body)?.[1];
  if (extraBlock) {
    const items = extraBlock
      .split("\n")
      .map((l) => l.replace(/^\s*\([א-ת0-9]+\)\s*/, "").trim())
      .filter(Boolean)
      .map((l) => "• " + clip(l, 110));
    if (items.length) extra = items.join("\n");
  }

  const directives = /\n\(ג\)\s*הוראות\s*\n([\s\S]*?)(?=\n\([א-ת]\)\s|\n\[\d+\]|$)/.exec(body)?.[1];

  return {
    found: true,
    primaryUse: clip(primary, 80),
    extraUses: extra,
    far: parseFar(body),
    height: parseHeight(body),
    directives: directives ? clip(directives, 220) : NONE,
    source,
  };
}

function parseAreaNotes(hits: string[]): string[] {
  const notes: string[] = [];
  for (const hit of hits) {
    const lines = hit.split("\n");
    if (!/^\[\d+\]\s*טבלה 5\.4/.test(lines[0])) continue;
    const label = /\[[^\]]*>\s*([^\]>]+)\]\s*$/.exec(lines[2] ?? "")?.[1]?.trim();
    const note = lines
      .slice(2)
      .map((l) => l.replace(/^\s*-\s*/, "").trim())
      .find((l) => l && !/^תשריט|^\[|^המרחב|^הערות והוראות/.test(l) && l.length > 12);
    if (label && note) notes.push(`${label}: ${clip(note, 140)}`);
    if (notes.length >= 4) break;
  }
  return notes;
}

/** Look up one zone (אזור ייעוד) in the plan, optionally scoped to a planning area (e.g. "901"). */
export async function fetchZoneInfo(zone: string, areaCode?: string): Promise<ZonePlanResult> {
  const args: Record<string, unknown> = {
    question: `הוראות ${zone}: שימושים, שטחי בניה, רח"ק וגובה`,
    zone_types: [zone],
  };
  if (areaCode) args.areas = [areaCode];

  let text = await searchPlan(args);
  let hits = splitHits(text);
  let zoneHit = hits.find((h) => /\|\s*אזור\s+יי?עוד\s*$/.test(h.split("\n")[0]));

  if (!zoneHit) {
    // The zone name from the map may not match the plan's wording as a filter — retry as free text.
    text = await searchPlan({ question: `${zone} שימושים רח"ק גובה`, ...(areaCode ? { areas: [areaCode] } : {}) });
    hits = splitHits(text);
    zoneHit = hits.find((h) => /^\[\d+\]\s*סעיף\s+3\./.test(h) && h.includes(zone));
  }

  const areaNotes = areaCode ? parseAreaNotes(hits) : [];
  if (!zoneHit) {
    return {
      info: { zone, found: false, primaryUse: NONE, extraUses: NONE, far: NONE, height: NONE, directives: NONE, source: "" },
      areaNotes,
    };
  }
  return { info: { zone, ...parseZoneHit(zoneHit, zone) }, areaNotes };
}
