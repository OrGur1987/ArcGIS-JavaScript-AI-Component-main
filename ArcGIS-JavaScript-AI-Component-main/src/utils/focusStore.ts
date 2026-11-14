import type Polygon from "@arcgis/core/geometry/Polygon";

import { resolveFocusFilters, type FocusFilters, type FocusValue, type GisCode, type ResolvedFocus } from "./focusFilters";
import { intersectFocusLayers } from "./focusIntersect";
import { buildFocusNotes, type FocusNote } from "./focusNotes";

export interface FocusState {
  /** The toggle: the assistant gets the focus only while it is on and a polygon is resolved. Off for every new polygon. */
  enabled: boolean;
  polygon: Polygon | null;
  status: "idle" | "loading" | "ready" | "error";
  /** What the polygon intersects, for the selection chips. */
  values: FocusValue[];
  filters: FocusFilters;
  notes: FocusNote[];
  unmapped: ResolvedFocus["unmapped"];
  /** Layers that could not be queried, or returned only part of their features. */
  failed: string[];
  truncated: string[];
}

const EMPTY: FocusState = {
  enabled: false,
  polygon: null,
  status: "idle",
  values: [],
  filters: { areas: [], zone_types: [], entities: [], headings: [] },
  notes: [],
  unmapped: [],
  failed: [],
  truncated: [],
};

let state: FocusState = EMPTY;
let running: AbortController | null = null;
const listeners = new Set<() => void>();

function update(next: Partial<FocusState>): void {
  state = { ...state, ...next };
  listeners.forEach((listener) => listener());
}

export const getFocusState = (): FocusState => state;

export function subscribeFocus(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export const setFocusEnabled = (enabled: boolean): void => update({ enabled });

export function clearFocus(): void {
  running?.abort();
  running = null;
  update({ ...EMPTY });
}

/** Intersects the polygon with the configured layers and derives the search filters and notes; a newer polygon cancels the run in progress. */
export async function setFocusPolygon(polygon: Polygon, loadGisCodes: () => Promise<GisCode[]>): Promise<void> {
  running?.abort();
  const controller = new AbortController();
  running = controller;
  update({ ...EMPTY, polygon, status: "loading" });
  try {
    const [intersect, gisCodes] = await Promise.all([intersectFocusLayers(polygon, undefined, controller.signal), loadGisCodes()]);
    if (controller.signal.aborted) return;
    const { filters, unmapped } = resolveFocusFilters(intersect.values, gisCodes);
    const notes = buildFocusNotes(intersect.values);
    update({ status: "ready", values: intersect.values, filters, notes, unmapped, failed: intersect.failed, truncated: intersect.truncated });
  } catch (err) {
    if (controller.signal.aborted) return;
    console.error("Polygon focus failed", err);
    update({ status: "error" });
  }
}

/** The filters and notes the assistant's plan search should use now, or null when the focus is off or not ready. */
export function getActiveFocus(): { filters: FocusFilters; notes: FocusNote[] } | null {
  return state.enabled && state.status === "ready" ? { filters: state.filters, notes: state.notes } : null;
}
