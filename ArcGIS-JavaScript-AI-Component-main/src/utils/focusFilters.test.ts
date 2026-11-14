import assert from "node:assert/strict";
import { test } from "node:test";

import { applyFocusToSearchArgs, resolveFocusFilters, type FocusValue, type GisCode } from "./focusFilters";

// a slice of the RAG's gis_codes (models.yml): 465 is not a zone type, so it goes to `headings`
const GIS_CODES: GisCode[] = [
  { layer: "zones", code: "362", key: "zone_types", value: "3.6.2" },
  { layer: "zones", code: "3617", key: "zone_types", value: "3.6.18" },
  { layer: "zones", code: "465", key: "headings", value: "4.6" },
  { layer: "foci", code: "335", key: "zone_types", value: "3.3.5" },
  { layer: "foci", code: "461", key: "headings", value: "4.7.1" },
];

test("each layer's code lands in the search filter the RAG expects", () => {
  const values: FocusValue[] = [
    { target: "areas", value: 703, weight: 0.9 }, // a small-integer field arrives as a number
    { target: "gis_code", gisLayer: "zones", value: "362", weight: 0.5 },
    { target: "gis_code", gisLayer: "zones", value: 465, weight: 0.3 },
    { target: "gis_code", gisLayer: "foci", value: "335", weight: 0.1 },
    { target: "entities", value: " ר-83 ", weight: 0.2 },
  ];
  const { filters, unmapped } = resolveFocusFilters(values, GIS_CODES);
  assert.deepEqual(filters, { areas: ["703"], zone_types: ["3.6.2", "3.3.5"], entities: ["ר-83"], headings: ["4.6"] });
  assert.deepEqual(unmapped, []);
});

test("the largest overlaps come first and each filter is capped", () => {
  const values: FocusValue[] = ["101", "102", "103", "104"].map((value, i) => ({ target: "areas", value, weight: i / 10 }));
  const { filters } = resolveFocusFilters(values, GIS_CODES, { areas: 2, zone_types: 8, entities: 8, headings: 4 });
  assert.deepEqual(filters.areas, ["104", "103"]);
});

test("a plain area code is dropped when one of its sub-areas is selected", () => {
  const values: FocusValue[] = [
    { target: "areas", value: "703", weight: 1 },
    { target: "areas", value: "702", weight: 0.4 },
    { target: "areas", value: "703ה", weight: 0.2 },
  ];
  assert.deepEqual(resolveFocusFilters(values, GIS_CODES).filters.areas, ["702", "703ה"]);
});

test("a code the RAG has no mapping for is reported, and repeated values count once", () => {
  const values: FocusValue[] = [
    { target: "gis_code", gisLayer: "zones", value: "999", weight: 0.5 },
    { target: "gis_code", gisLayer: "foci", value: "461", weight: 0.4 },
    { target: "gis_code", gisLayer: "foci", value: "461", weight: 0.3 }, // 461 and 462 name the same section
  ];
  const { filters, unmapped } = resolveFocusFilters(values, GIS_CODES);
  assert.deepEqual(unmapped, [{ gisLayer: "zones", code: "999" }]);
  assert.deepEqual(filters.headings, ["4.7.1"]);
});

test("filters the caller passed itself win over the focus", () => {
  const focus = { areas: ["703"], zone_types: ["3.3.5"], entities: [], headings: [] };
  const merged = applyFocusToSearchArgs({ question: "שאלה", zone_types: ["3.4.1"], areas: [] }, focus);
  assert.deepEqual(merged, { question: "שאלה", zone_types: ["3.4.1"], areas: ["703"] });
});

test("focus notes replace whatever notes the model passed", () => {
  const focus = { areas: [], zone_types: [], entities: [], headings: [] };
  const notes = [{ text: "t", layer: "l", code: "1", priority: 1 as const, weight: 0.5 }];
  assert.deepEqual(applyFocusToSearchArgs({ question: "q" }, focus, notes), { question: "q", focus_notes: notes });
  assert.deepEqual(applyFocusToSearchArgs({ question: "q", focus_notes: [{ text: "invented" }] }, focus, notes).focus_notes, notes);
  assert.equal("focus_notes" in applyFocusToSearchArgs({ question: "q", focus_notes: [{ text: "invented" }] }, focus, []), false);
});
