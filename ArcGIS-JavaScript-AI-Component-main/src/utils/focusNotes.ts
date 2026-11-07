import { FOCUS_LAYERS, FOCUS_NOTE_LIMITS, type FocusLayer } from "../config/focusLayers";
import type { FocusValue } from "./focusFilters";

/** One entry of `focus_notes` in the RAG's /v1/search. */
export interface FocusNote {
  text: string;
  layer: string;
  code: string;
  priority: 1 | 2 | 3;
  weight: number;
}

const clean = (value: unknown): string => String(value ?? "").replace(/\s+/g, " ").trim();

/** The note values of the intersect result as `focus_notes`: most important layers first, then the largest overlap; capped per layer and in total. */
export function buildFocusNotes(
  values: FocusValue[],
  layers: FocusLayer[] = FOCUS_LAYERS,
  limits: { perLayer: number; total: number } = FOCUS_NOTE_LIMITS,
): FocusNote[] {
  const layerById = new Map(layers.map((l) => [l.id, l]));
  const taken = new Map<string, number>();
  const notes: FocusNote[] = [];
  const candidates = values
    .filter((v) => v.target === "note" && v.layerId && layerById.has(v.layerId))
    .sort((a, b) => (layerById.get(a.layerId!)!.priority ?? 2) - (layerById.get(b.layerId!)!.priority ?? 2) || b.weight - a.weight);
  for (const value of candidates) {
    const layer = layerById.get(value.layerId!)!;
    const code = clean(value.value);
    if (!code || (taken.get(layer.id) ?? 0) >= limits.perLayer) continue;
    taken.set(layer.id, (taken.get(layer.id) ?? 0) + 1);
    notes.push({ text: `${layer.label}: ${clean(value.label) || code}`.slice(0, 300), layer: layer.id, code, priority: layer.priority ?? 2, weight: value.weight });
    if (notes.length >= limits.total) break;
  }
  return notes;
}
