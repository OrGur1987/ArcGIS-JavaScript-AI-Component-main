import { MIN_OVERLAP_SHARE } from "../config/focusLayers";

/** One feature of a layer that overlaps the selection: its code and how much of it lies inside (area, length or 1 for a point). */
export interface OverlapRow {
  code: string | number | null | undefined;
  label?: string | null;
  measure: number;
}

export interface OverlapValue {
  code: string;
  label: string;
  /** Polygons: share of the selection's area they cover. Lines: length relative to the longest. Points: 1. */
  weight: number;
}

/** Sums the overlaps per code and turns them into weights, largest first; polygon slivers below `minShare` are dropped. */
export function aggregateOverlaps(
  rows: OverlapRow[],
  geometry: "polygon" | "polyline" | "point",
  selectionArea: number,
  minShare = MIN_OVERLAP_SHARE,
): OverlapValue[] {
  const byCode = new Map<string, { label: string; measure: number }>();
  for (const { code, label, measure } of rows) {
    const key = String(code ?? "").replace(/\s+/g, " ").trim();
    if (!key || !(measure > 0)) continue;
    const entry = byCode.get(key) ?? { label: "", measure: 0 };
    entry.measure += measure;
    entry.label ||= String(label ?? "").trim();
    byCode.set(key, entry);
  }
  const longest = Math.max(0, ...[...byCode.values()].map((e) => e.measure));
  const weightOf = (measure: number): number =>
    geometry === "polygon" ? Math.min(1, measure / selectionArea) : geometry === "polyline" ? measure / longest : 1;
  return [...byCode]
    .map(([code, { label, measure }]) => ({ code, label: label || code, weight: weightOf(measure) }))
    .filter((v) => geometry !== "polygon" || v.weight >= minShare)
    .sort((a, b) => b.weight - a.weight);
}
