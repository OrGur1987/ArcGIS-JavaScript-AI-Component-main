import assert from "node:assert/strict";
import test from "node:test";

import type { FocusLayer } from "../config/focusLayers";
import type { FocusValue } from "./focusFilters";
import { buildFocusNotes } from "./focusNotes";

const layer = (id: string, label: string, priority: 1 | 2 | 3): FocusLayer => ({
  id, label, serviceUrl: "", layerId: 0, geometry: "polygon", codeField: "c", target: "note", priority,
});
const LAYERS = [layer("axes", "צירי תכנון", 1), layer("infra", "תשתית", 3)];
const value = (layerId: string, v: string, weight: number, label = ""): FocusValue => ({ target: "note", layerId, value: v, weight, label });

test("notes are ordered by layer priority then overlap, capped per layer and in total, and carry the code", () => {
  const values = [
    value("infra", "4846", 0.9, "פשט הצפה"),
    value("axes", "3613", 0.2, "ציר ירוק"),
    value("axes", "3623", 0.5),
    value("axes", "3625", 0.1),
    { target: "areas", value: "703", weight: 1 } as FocusValue, // filters are not notes
  ];
  const notes = buildFocusNotes(values, LAYERS, { perLayer: 2, total: 3 });
  assert.deepEqual(notes.map((n) => n.code), ["3623", "3613", "4846"]);
  assert.deepEqual(notes[0], { text: "צירי תכנון: 3623", layer: "axes", code: "3623", priority: 1, weight: 0.5 });
  assert.equal(notes[2].text, "תשתית: פשט הצפה");
});
