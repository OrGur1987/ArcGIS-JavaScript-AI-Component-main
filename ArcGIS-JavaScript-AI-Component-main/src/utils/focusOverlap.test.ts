import assert from "node:assert/strict";
import { test } from "node:test";

import { aggregateOverlaps } from "./focusOverlap";

test("polygon overlaps are summed per code into shares of the selection, slivers dropped", () => {
  const rows = [
    { code: 322, label: "אזור מגורים בבניה נמוכה", measure: 30 },
    { code: 322, label: "", measure: 20 }, // the same zone in a second piece
    { code: 341, label: "אזור מעורב", measure: 40 },
    { code: 362, label: "ים", measure: 1 }, // 1% of the selection: a sliver
    { code: null, label: "no code", measure: 9 },
  ];
  assert.deepEqual(aggregateOverlaps(rows, "polygon", 100), [
    { code: "322", label: "אזור מגורים בבניה נמוכה", weight: 0.5 },
    { code: "341", label: "אזור מעורב", weight: 0.4 },
  ]);
});

test("a line weighs its length against the longest line, a point always counts fully", () => {
  const lines = [{ code: "ר-31", label: "אבן גבירול", measure: 200 }, { code: "ר-12", label: "איינשטיין", measure: 50 }];
  assert.deepEqual(aggregateOverlaps(lines, "polyline", 100).map((v) => [v.code, v.weight]), [["ר-31", 1], ["ר-12", 0.25]]);
  const points = [{ code: 335, label: "מוקד תעסוקה חדש", measure: 1 }, { code: 335, label: "מוקד תעסוקה חדש", measure: 1 }];
  assert.deepEqual(aggregateOverlaps(points, "point", 100), [{ code: "335", label: "מוקד תעסוקה חדש", weight: 1 }]);
});
