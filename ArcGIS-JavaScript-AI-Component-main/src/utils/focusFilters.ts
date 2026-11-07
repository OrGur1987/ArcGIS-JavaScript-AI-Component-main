import { FOCUS_LIMITS } from "../config/focusLayers";

export type SearchKey = "areas" | "zone_types" | "entities" | "headings";
export type FocusFilters = Record<SearchKey, string[]>;

/** One entry of the RAG's `gis_codes` (GET /v1/locations): a GIS layer code and the search filter that reaches the same plan section. */
export interface GisCode {
  layer: string;
  code: string;
  key: "zone_types" | "headings";
  value: string;
}

/** A code read from a feature that overlaps the selected polygon; `weight` is the share of the polygon it covers (0-1). */
export interface FocusValue {
  target: "areas" | "entities" | "gis_code";
  gisLayer?: string;
  value: string | number;
  weight: number;
}

export interface ResolvedFocus {
  filters: FocusFilters;
  /** GIS codes the RAG has no mapping for, so they add no filter. */
  unmapped: Array<{ gisLayer: string; code: string }>;
}

const clean = (value: unknown): string => String(value ?? "").replace(/\s+/g, " ").trim();
const PLAIN_AREA = /^\d{3}$/;

/** Maps the codes of the intersected features to the filters of /v1/search. */
export function resolveFocusFilters(
  values: FocusValue[],
  gisCodes: GisCode[],
  limits: Record<SearchKey, number> = FOCUS_LIMITS,
): ResolvedFocus {
  const byCode = new Map<string, GisCode[]>();
  for (const entry of gisCodes) {
    const id = `${entry.layer}:${clean(entry.code)}`;
    byCode.set(id, [...(byCode.get(id) ?? []), entry]);
  }

  const found: Record<SearchKey, Set<string>> = { areas: new Set(), zone_types: new Set(), entities: new Set(), headings: new Set() };
  const unmapped: ResolvedFocus["unmapped"] = [];
  for (const { target, gisLayer = "", value } of [...values].sort((a, b) => b.weight - a.weight)) {
    const code = clean(value);
    if (!code) continue;
    if (target !== "gis_code") {
      found[target === "areas" ? "areas" : "entities"].add(code);
      continue;
    }
    const entries = byCode.get(`${gisLayer}:${code}`);
    if (!entries) unmapped.push({ gisLayer, code });
    else entries.forEach((e) => found[e.key].add(clean(e.value)));
  }

  // a plain area code asks the RAG for the whole area, so it would undo the narrowing of its own sub-areas
  const areas = [...found.areas].filter((a) => !(PLAIN_AREA.test(a) && [...found.areas].some((s) => s !== a && s.startsWith(a))));
  const filters: FocusFilters = {
    areas, zone_types: [...found.zone_types], entities: [...found.entities], headings: [...found.headings],
  };
  for (const key of Object.keys(filters) as SearchKey[]) filters[key] = filters[key].slice(0, limits[key]);
  return { filters, unmapped };
}

/** The focus filters for the keys the caller left empty; filters the caller passed itself (from the user's wording) are kept. */
export function applyFocusToSearchArgs(args: Record<string, unknown>, focus: FocusFilters): Record<string, unknown> {
  const merged = { ...args };
  for (const key of Object.keys(focus) as SearchKey[]) {
    const given = merged[key];
    if (focus[key].length && !(Array.isArray(given) && given.length)) merged[key] = focus[key];
  }
  return merged;
}
