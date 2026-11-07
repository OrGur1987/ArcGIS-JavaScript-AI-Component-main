import * as areaOperator from "@arcgis/core/geometry/operators/areaOperator";
import * as intersectionOperator from "@arcgis/core/geometry/operators/intersectionOperator";
import * as lengthOperator from "@arcgis/core/geometry/operators/lengthOperator";
import type Polygon from "@arcgis/core/geometry/Polygon";
import { executeQueryJSON } from "@arcgis/core/rest/query";
import Query from "@arcgis/core/rest/support/Query";
import type { GeometryUnion } from "@arcgis/core/unionTypes";

import { FOCUS_LAYERS, type FocusLayer } from "../config/focusLayers";
import type { FocusValue } from "./focusFilters";
import { aggregateOverlaps, type OverlapRow } from "./focusOverlap";

export interface FocusIntersect {
  values: FocusValue[];
  /** Layers with more features than the service returns at once; their overlaps are partial. */
  truncated: string[];
  /** Layers that could not be queried. */
  failed: string[];
}

async function queryOverlaps(layer: FocusLayer, selection: Polygon, signal?: AbortSignal) {
  const query = new Query({
    geometry: selection,
    spatialRelationship: "intersects",
    outFields: [layer.codeField, ...(layer.labelField ? [layer.labelField] : [])],
    returnGeometry: layer.geometry !== "point",
    outSpatialReference: selection.spatialReference, // overlaps are measured in the selection's own units
    maxAllowableOffset: selection.spatialReference.isGeographic ? 1e-5 : 1,
  });
  const result = await executeQueryJSON(`${layer.serviceUrl}/${layer.layerId}`, query, { signal });
  const rows: OverlapRow[] = result.features.map((feature) => {
    let measure = 1;
    if (layer.geometry !== "point") {
      const inside = feature.geometry ? intersectionOperator.execute(feature.geometry as GeometryUnion, selection) : null;
      measure = !inside ? 0 : layer.geometry === "polygon" ? areaOperator.execute(inside) : lengthOperator.execute(inside);
    }
    return { code: feature.attributes[layer.codeField], label: layer.labelField ? feature.attributes[layer.labelField] : null, measure };
  });
  return { rows, truncated: Boolean(result.exceededTransferLimit) };
}

/** The codes of the configured layers' features that overlap the selection, with the share of the selection each covers. */
export async function intersectFocusLayers(
  selection: Polygon,
  layers: FocusLayer[] = FOCUS_LAYERS,
  signal?: AbortSignal,
): Promise<FocusIntersect> {
  const result: FocusIntersect = { values: [], truncated: [], failed: [] };
  const selectionArea = Math.abs(areaOperator.execute(selection));
  if (!(selectionArea > 0)) return result;

  const settled = await Promise.allSettled(layers.map((layer) => queryOverlaps(layer, selection, signal)));
  if (signal?.aborted) throw new DOMException("The focus query was aborted.", "AbortError");
  settled.forEach((outcome, i) => {
    const layer = layers[i];
    if (outcome.status === "rejected") {
      result.failed.push(layer.id);
      return;
    }
    if (outcome.value.truncated) result.truncated.push(layer.id);
    for (const { code, label, weight } of aggregateOverlaps(outcome.value.rows, layer.geometry, selectionArea)) {
      result.values.push({ target: layer.target, gisLayer: layer.gisLayer, value: code, weight, layerId: layer.id, label });
    }
  });
  return result;
}
