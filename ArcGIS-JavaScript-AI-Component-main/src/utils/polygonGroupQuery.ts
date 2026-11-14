import Graphic from "@arcgis/core/Graphic";
import GraphicsLayer from "@arcgis/core/layers/GraphicsLayer";
import SketchViewModel from "@arcgis/core/widgets/Sketch/SketchViewModel";
import FeatureFilter from "@arcgis/core/layers/support/FeatureFilter";
import * as geodesicBufferOperator from "@arcgis/core/geometry/operators/geodesicBufferOperator.js";
import * as unionOperator from "@arcgis/core/geometry/operators/unionOperator.js";
import * as reactiveUtils from "@arcgis/core/core/reactiveUtils.js";
import Extent from "@arcgis/core/geometry/Extent";
import type Polygon from "@arcgis/core/geometry/Polygon";
import {
  CARD_ASPECT,
  PAGE_H,
  PAGE_W,
  composeCardsPage,
  composeMapPage,
  composeTablePage,
  downloadBytes,
  jpegsToPdf,
  type MapCard,
  type TableColumn,
  type TableRow,
} from "./groupPdf";
import { fetchZoneInfo, type ZonePlanResult } from "./planInfo";

/** Buffer distance (meters) applied around the drawn polygon / plan boundary. */
export const QUERY_BUFFER_METERS = 100;

export interface LayerGroupSpec {
  key: string;
  label: string;
  /** Matches the GroupLayer title in the WebMap (Hebrew titles from the planning sketch). */
  match: RegExp;
}

/** The 5 layer groups from the planning-info sketch (דף מידע מתארי). */
export const LAYER_GROUPS: LayerGroupSpec[] = [
  { key: "zoning", label: "אזורי ייעוד", match: /ייעוד/ },
  { key: "urban-design", label: "עיצוב עירוני", match: /עיצוב\s*עירוני/ },
  { key: "planning-areas", label: "אזורי ומרחבי תכנון", match: /מרחבי\s*תכנון|אזורי\s*תכנון/ },
  { key: "transport", label: "תחבורה וניידות", match: /תחבורה|ניידות/ },
  { key: "infrastructure", label: "תשתיות", match: /תשתיות|תשתית/ },
];

/** The 4 groups shown as map cards on page 2 of the PDF, in sketch order. */
const CARD_GROUP_KEYS = ["urban-design", "planning-areas", "transport", "infrastructure"];

/** How much of the image width/height the area of interest (its bounding box) should fill in the PDF maps. */
const FILL_FRACTION = 0.75;

const ZONE_COLORS = ["#ffa500", "#ff5a00", "#b266ff", "#5cb85c"];

export type AnalysisMode = "manual" | "boundary";

export interface LayerHit {
  id: string;
  title: string;
  /** Features intersecting polygon + buffer. */
  count: number;
  /** Features intersecting the polygon itself (count − countInPolygon = only in the buffer ring). */
  countInPolygon: number;
  geometryType: string;
  visible: boolean;
}

export interface GroupResult {
  key: string;
  label: string;
  /** False when no group layer with a matching title exists in the map. */
  found: boolean;
  layers: LayerHit[];
}

export interface PolygonQueryResult {
  groups: GroupResult[];
  mode: AnalysisMode;
}

export interface BoundaryLayerOption {
  key: string;
  title: string;
}

type AnyLayer = any;

// ── Layer-tree helpers ───────────────────────────────────────────────────────

function toArray(collection: any): AnyLayer[] {
  return collection?.toArray?.() ?? (Array.isArray(collection) ? collection : []);
}

function childrenOf(layer: AnyLayer): AnyLayer[] {
  // GroupLayer.layers, MapImageLayer.sublayers, Sublayer.sublayers
  return toArray(layer?.layers ?? layer?.sublayers);
}

function isQueryable(layer: AnyLayer): boolean {
  return typeof layer?.queryFeatureCount === "function";
}

function findGroupLayer(roots: AnyLayer[], spec: LayerGroupSpec): AnyLayer | null {
  for (const layer of roots) {
    if (layer?.type === "group" && spec.match.test(String(layer.title ?? ""))) return layer;
    if (layer?.type === "group") {
      const nested = findGroupLayer(childrenOf(layer), spec);
      if (nested) return nested;
    }
  }
  return null;
}

/** Every queryable leaf below a group (feature layers and map-service sublayers). */
function collectLeaves(group: AnyLayer, parents: AnyLayer[] = []): { leaf: AnyLayer; parents: AnyLayer[] }[] {
  const out: { leaf: AnyLayer; parents: AnyLayer[] }[] = [];
  for (const child of childrenOf(group)) {
    const kids = childrenOf(child);
    if (kids.length > 0) {
      out.push(...collectLeaves(child, [...parents, group]));
    } else if (isQueryable(child)) {
      out.push({ leaf: child, parents: [...parents, group] });
    }
  }
  return out;
}

function pickNameField(featureSet: any): string | null {
  const fields = (featureSet?.fields ?? []).filter(
    (f: any) => f.type === "string" && !/^(globalid|guid)$/i.test(String(f.name)),
  );
  if (featureSet?.displayFieldName && fields.some((f: any) => f.name === featureSet.displayFieldName)) {
    return featureSet.displayFieldName;
  }
  const preferred = fields.find((f: any) =>
    /יעוד|ייעוד|zone|landuse|name|שם|desc|תיאור|type|סוג/i.test(`${f.name} ${f.alias ?? ""}`),
  );
  return (preferred ?? fields[0])?.name ?? null;
}

// ── Controller ───────────────────────────────────────────────────────────────

/**
 * Owns the sketch tool and the highlight graphics for one map view.
 * Flow: draw a polygon (or take the plan-boundary layer) → 100 m geodesic buffer → for each of the
 * 5 groups, query every sublayer against the buffer, show the layers that have features and clip
 * their rendering to the buffer → export the planning-info sheet (PDF).
 */
export class PolygonGroupQueryController {
  private view: any;
  private sketchLayer: GraphicsLayer;
  private sketchVM: SketchViewModel;
  private filteredLayerViews: any[] = [];
  private touchedVisibility = new Map<AnyLayer, boolean>();
  private runId = 0;
  /** Sublayer ids are only unique per service, so results reference leaves by a generated key. */
  private leafByKey = new Map<string, AnyLayer>();
  private groupLayerByKey = new Map<string, AnyLayer>();
  private boundaryLayerByKey = new Map<string, AnyLayer>();
  private analysis: { polygon: Polygon; buffer: Polygon; mode: AnalysisMode; result: PolygonQueryResult } | null = null;

  constructor(
    view: any,
    private readonly onResult: (result: PolygonQueryResult) => void,
    private readonly onBusy: (busy: boolean) => void,
    private readonly onError: (message: string) => void,
    private readonly onDrawing: (drawing: boolean) => void,
  ) {
    this.view = view;
    this.sketchLayer = new GraphicsLayer({ id: "polygon-query-sketch", listMode: "hide" });
    view.map.add(this.sketchLayer);

    this.sketchVM = new SketchViewModel({
      view,
      layer: this.sketchLayer,
      polygonSymbol: PLAN_SYMBOL as any,
    });

    this.sketchVM.on("create", (event: any) => {
      if (event.state === "cancel") {
        this.onDrawing(false);
      } else if (event.state === "complete") {
        this.onDrawing(false);
        void this.analyze(event.graphic.geometry as Polygon, "manual", event.graphic);
      }
    });
  }

  hasAnalysis(): boolean {
    return this.analysis !== null;
  }

  /** The polygon of the current analysis, before buffering. */
  getPolygon(): Polygon | null {
    return this.analysis?.polygon ?? null;
  }

  startDrawing(): void {
    this.clear();
    this.onDrawing(true);
    this.sketchVM.create("polygon");
  }

  cancelDrawing(): void {
    this.sketchVM.cancel();
    this.onDrawing(false);
  }

  /** Remove graphics, filters, and restore layer visibility to what it was before. */
  clear(): void {
    this.runId++;
    this.sketchVM.cancel();
    this.sketchLayer.removeAll();
    for (const lv of this.filteredLayerViews) {
      try {
        lv.filter = null;
      } catch {
        /* layer view may be gone */
      }
    }
    this.filteredLayerViews = [];
    for (const [layer, visible] of this.touchedVisibility) {
      try {
        layer.visible = visible;
      } catch {
        /* ignore */
      }
    }
    this.touchedVisibility.clear();
    this.leafByKey.clear();
    this.groupLayerByKey.clear();
    this.analysis = null;
  }

  destroy(): void {
    this.clear();
    this.sketchVM.destroy();
    try {
      this.view?.map?.remove(this.sketchLayer);
    } catch {
      /* map may already be gone */
    }
  }

  setLayerVisible(layerId: string, visible: boolean): void {
    const layer = this.leafByKey.get(layerId);
    if (!layer) return;
    this.setVisible(layer, visible);
  }

  private setVisible(layer: AnyLayer, visible: boolean): void {
    if (!this.touchedVisibility.has(layer)) this.touchedVisibility.set(layer, !!layer.visible);
    layer.visible = visible;
  }

  // ── Plan boundary mode ─────────────────────────────────────────────────────

  /** Polygon feature layers in the map, those that look like a plan boundary first. */
  listPolygonLayers(): BoundaryLayerOption[] {
    this.boundaryLayerByKey.clear();
    const found: { key: string; title: string; likely: boolean }[] = [];
    const walk = (layers: AnyLayer[], path: string) => {
      layers.forEach((layer, i) => {
        if (layer === this.sketchLayer) return;
        const key = `${path}/${i}`;
        const kids = childrenOf(layer);
        if (kids.length > 0) return walk(kids, key);
        if (isQueryable(layer) && layer.geometryType === "polygon") {
          const title = String(layer.title ?? layer.id);
          this.boundaryLayerByKey.set(key, layer);
          found.push({ key, title, likely: /גבול|גבולות|תכנית|תוכנית|boundary/i.test(title) });
        }
      });
    };
    walk(toArray(this.view.map.layers), "L");
    found.sort((a, b) => Number(b.likely) - Number(a.likely));
    return found.map(({ key, title }) => ({ key, title }));
  }

  /** Use all features of the chosen layer (unioned) as the area of interest. */
  async analyzeBoundary(layerKey: string): Promise<void> {
    const layer = this.boundaryLayerByKey.get(layerKey);
    if (!layer) {
      this.onError("שכבת גבול התכנית לא נמצאה");
      return;
    }
    this.clear();
    this.onBusy(true);
    try {
      const fs = await layer.queryFeatures({
        where: "1=1",
        returnGeometry: true,
        outSpatialReference: this.view.spatialReference,
      });
      const geoms = fs.features.map((f: any) => f.geometry).filter(Boolean);
      if (geoms.length === 0) throw new Error("בשכבת גבול התכנית שנבחרה אין ישויות");
      const union = geoms.length === 1 ? geoms[0] : (unionOperator.executeMany(geoms) as Polygon | null);
      if (!union) throw new Error("איחוד גבולות התכנית נכשל");
      await this.analyze(union as Polygon, "boundary");
    } catch (err) {
      this.onError(err instanceof Error ? err.message : String(err));
      this.onBusy(false);
    }
  }

  // ── Analysis ───────────────────────────────────────────────────────────────

  private async analyze(polygon: Polygon, mode: AnalysisMode, sketchGraphic?: Graphic): Promise<void> {
    const runId = ++this.runId;
    this.onBusy(true);
    try {
      await geodesicBufferOperator.load();
      const buffer = geodesicBufferOperator.execute(polygon, QUERY_BUFFER_METERS, { unit: "meters" } as any);
      if (!buffer) throw new Error("יצירת הבאפר נכשלה");

      this.sketchLayer.removeAll();
      this.sketchLayer.add(
        new Graphic({
          geometry: buffer,
          symbol: {
            type: "simple-fill",
            color: [0, 0, 255, 0.03],
            outline: { color: [0, 0, 255, 0.8], width: 1.5, style: "dash" },
          } as any,
        }),
      );
      this.sketchLayer.add(sketchGraphic ?? new Graphic({ geometry: polygon, symbol: PLAN_SYMBOL as any }));

      const roots = toArray(this.view.map.layers);
      const groups: GroupResult[] = [];

      for (const spec of LAYER_GROUPS) {
        const group = findGroupLayer(roots, spec);
        if (!group) {
          groups.push({ key: spec.key, label: spec.label, found: false, layers: [] });
          continue;
        }
        const leaves = collectLeaves(group);
        const hits = await Promise.all(
          leaves.map(async ({ leaf, parents }) => {
            let count = 0;
            let countInPolygon = 0;
            let geometryType = String(leaf.geometryType ?? "");
            try {
              if (typeof leaf.load === "function") await leaf.load();
              geometryType = String(leaf.geometryType ?? geometryType);
              [count, countInPolygon] = await Promise.all([
                leaf.queryFeatureCount({ geometry: buffer, spatialRelationship: "intersects", returnGeometry: false }),
                leaf.queryFeatureCount({ geometry: polygon, spatialRelationship: "intersects", returnGeometry: false }),
              ]);
              if (!geometryType && count > 0) {
                const one = await leaf.queryFeatures({ geometry: buffer, num: 1, returnGeometry: false });
                geometryType = String(one?.geometryType ?? "");
              }
            } catch {
              count = 0;
              countInPolygon = 0;
            }
            return { leaf, parents, count, countInPolygon, geometryType };
          }),
        );
        if (runId !== this.runId) return; // a newer run / clear superseded this one

        this.groupLayerByKey.set(spec.key, group);
        this.setVisible(group, true);
        const layerHits: LayerHit[] = [];
        for (const [i, { leaf, parents, count, countInPolygon, geometryType }] of hits.entries()) {
          const key = `${spec.key}:${i}`;
          this.leafByKey.set(key, leaf);
          const show = count > 0;
          if (show) parents.forEach((p) => this.setVisible(p, true));
          this.setVisible(leaf, show);
          if (show) void this.clipToBuffer(leaf, buffer);
          layerHits.push({
            id: key,
            title: String(leaf.title ?? leaf.id),
            count,
            countInPolygon,
            geometryType,
            visible: show,
          });
        }
        layerHits.sort((a, b) => b.count - a.count);
        groups.push({ key: spec.key, label: spec.label, found: true, layers: layerHits });
      }

      if (runId !== this.runId) return;
      if (buffer.extent) {
        await this.view.goTo(buffer.extent.clone().expand(1.4), { duration: 600 }).catch(() => undefined);
      }
      const result: PolygonQueryResult = { groups, mode };
      this.analysis = { polygon, buffer, mode, result };
      this.onResult(result);
    } catch (err) {
      this.onError(err instanceof Error ? err.message : String(err));
    } finally {
      if (runId === this.runId) this.onBusy(false);
    }
  }

  /** Clip a feature layer's rendering to the buffer (map-service sublayers can't be clipped client-side). */
  private async clipToBuffer(layer: AnyLayer, buffer: Polygon): Promise<void> {
    if (layer?.type !== "feature") return;
    try {
      const lv = await this.view.whenLayerView(layer);
      lv.filter = new FeatureFilter({ geometry: buffer, spatialRelationship: "intersects" });
      this.filteredLayerViews.push(lv);
    } catch {
      /* layer view unavailable (e.g. layer hidden at this scale) — visibility is still applied */
    }
  }

  // ── Planning-info sheet (PDF) ──────────────────────────────────────────────

  /**
   * One PDF, three kinds of page:
   *  1. the zoning group (אזורי ייעוד) as a full map, like sketch page 2;
   *  2. the other four groups as a row of map cards, like sketch page 3;
   *  3. a summary table per zone, with the master-plan text from the RAG, like sketch page 5.
   * The layer visibility and view the user had are restored afterwards.
   */
  async exportInfoSheet(onProgress?: (message: string) => void): Promise<void> {
    const a = this.analysis;
    if (!a) throw new Error("יש לבחור אזור (פוליגון או גבול תכנית) לפני הייצוא");
    if (!this.groupLayerByKey.get("zoning")) throw new Error("לא נמצאה קבוצת שכבות 'אזורי ייעוד' במפה");
    if (!a.polygon.extent) throw new Error("לא ניתן לחשב את תחום האזור");

    const pageFrame = this.frameFor(PAGE_W / PAGE_H);
    const cardFrame = this.frameFor(CARD_ASPECT);

    const savedVisibility = new Map<AnyLayer, boolean>();
    for (const g of this.groupLayerByKey.values()) savedVisibility.set(g, !!g.visible);
    const savedViewpoint = this.view.viewpoint?.clone?.();

    const showOnly = async (key: string | null, frame: Extent) => {
      for (const [k, layer] of this.groupLayerByKey) layer.visible = k === key;
      await this.view.goTo(frame, { animate: false }).catch(() => undefined);
      await new Promise((r) => window.setTimeout(r, 300));
      await Promise.race([
        reactiveUtils.whenOnce(() => !this.view.updating),
        new Promise((r) => window.setTimeout(r, 15000)),
      ]);
    };
    const shoot = async (): Promise<string> => (await this.view.takeScreenshot({ format: "png" })).dataUrl;

    try {
      onProgress?.("מצלם: אזורי ייעוד");
      await showOnly("zoning", pageFrame);
      const page1 = await composeMapPage({
        title: "אזורי ייעוד",
        screenshotDataUrl: await shoot(),
        scale: Number(this.view.scale) || 0,
      });

      const cards: MapCard[] = [];
      let first = true;
      for (const key of CARD_GROUP_KEYS) {
        const spec = LAYER_GROUPS.find((g) => g.key === key)!;
        if (!this.groupLayerByKey.has(key)) {
          cards.push({ title: spec.label, screenshotDataUrl: null });
          continue;
        }
        onProgress?.(`מצלם: ${spec.label}`);
        await showOnly(key, cardFrame);
        if (first) first = false;
        cards.push({ title: spec.label, screenshotDataUrl: await shoot() });
      }
      const page2 = await composeCardsPage(cards);

      onProgress?.("שולף נתוני תוכנית המתאר מה-RAG");
      const page3 = await this.buildTablePage();

      downloadBytes(jpegsToPdf([page1, page2, page3]), "דף מידע מתארי.pdf");
    } finally {
      for (const [layer, visible] of savedVisibility) layer.visible = visible;
      if (savedViewpoint) await this.view.goTo(savedViewpoint, { animate: false }).catch(() => undefined);
    }
  }

  /**
   * The map extent for a PDF image of the given width/height ratio: centred on the polygon, sized so
   * the polygon's bounding box fills FILL_FRACTION of the limiting dimension. Layers that stick out
   * of the polygon are simply cropped by the frame.
   */
  private frameFor(aspect: number): Extent {
    const e = this.analysis!.polygon.extent!;
    const cx = (e.xmin + e.xmax) / 2;
    const cy = (e.ymin + e.ymax) / 2;
    const w = Math.max(e.width, e.height * aspect, 1e-9) / FILL_FRACTION;
    const h = w / aspect;
    return new Extent({
      xmin: cx - w / 2,
      xmax: cx + w / 2,
      ymin: cy - h / 2,
      ymax: cy + h / 2,
      spatialReference: e.spatialReference,
    });
  }

  /** Zone names inside the area (from the zoning group) and the planning-area code (e.g. 901). */
  private async discoverZonesAndArea(): Promise<{ zones: string[]; areaCode?: string }> {
    const a = this.analysis!;
    const hitsOf = (key: string) =>
      (a.result.groups.find((g) => g.key === key)?.layers ?? []).filter((l) => l.count > 0);

    const queryNames = async (hit: LayerHit, geometry: Polygon, allFields: boolean) => {
      const leaf = this.leafByKey.get(hit.id);
      if (!leaf) return { fs: null as any, field: null as string | null };
      const fs = await leaf.queryFeatures({
        geometry,
        spatialRelationship: "intersects",
        outFields: ["*"],
        returnGeometry: false,
      });
      return { fs, field: allFields ? null : pickNameField(fs) };
    };

    // Zones: prefer what lies inside the polygon; fall back to the buffer ring.
    const zoneCounts = new Map<string, number>();
    for (const hit of hitsOf("zoning")) {
      let { fs, field } = await queryNames(hit, a.polygon, false);
      if (fs && fs.features.length === 0) ({ fs, field } = await queryNames(hit, a.buffer, false));
      if (!fs || !field) continue;
      for (const f of fs.features) {
        const name = String(f.attributes?.[field] ?? "").trim();
        if (name) zoneCounts.set(name, (zoneCounts.get(name) ?? 0) + 1);
      }
    }
    const zones = [...zoneCounts.entries()].sort((x, y) => y[1] - x[1]).map(([n]) => n);

    // Planning area: most frequent 3-digit code in the string attributes of the planning-areas group.
    const codeCounts = new Map<string, number>();
    for (const hit of hitsOf("planning-areas")) {
      const { fs } = await queryNames(hit, a.polygon, true);
      if (!fs) continue;
      const stringFields = (fs.fields ?? []).filter((f: any) => f.type === "string").map((f: any) => f.name);
      for (const f of fs.features) {
        for (const name of stringFields) {
          const m = /(?:^|\s)([1-9]\d{2})(?=\s|$|[א-ת'])/.exec(String(f.attributes?.[name] ?? ""));
          if (m) codeCounts.set(m[1], (codeCounts.get(m[1]) ?? 0) + 1);
        }
      }
    }
    const areaCode = [...codeCounts.entries()].sort((x, y) => y[1] - x[1])[0]?.[0];
    return { zones, areaCode };
  }

  private alertsText(pick: (l: LayerHit) => boolean): string {
    const titles: string[] = [];
    for (const g of this.analysis!.result.groups) {
      if (g.key === "zoning") continue;
      for (const l of g.layers) if (pick(l) && !titles.includes(l.title)) titles.push(l.title);
    }
    return titles.length ? titles.join(", ") : "-";
  }

  private async buildTablePage() {
    const a = this.analysis!;
    const { zones, areaCode } = await this.discoverZonesAndArea();
    const usedZones = zones.slice(0, 4);

    const errors: string[] = [];
    const results: (ZonePlanResult | null)[] = await Promise.all(
      usedZones.map((z) =>
        fetchZoneInfo(z, areaCode).catch((err) => {
          errors.push(err instanceof Error ? err.message : String(err));
          return null;
        }),
      ),
    );

    const columns: TableColumn[] = usedZones.length
      ? usedZones.map((z, i) => ({ title: z, color: ZONE_COLORS[i % ZONE_COLORS.length] }))
      : [{ title: "לא זוהה אזור ייעוד", color: "#cccccc" }];
    const col = (pick: (z: ZonePlanResult) => string) =>
      usedZones.length ? results.map((r) => (r ? pick(r) : "—")) : ["—"];
    const repeat = (text: string) => columns.map(() => text);

    const inPoly = (l: LayerHit) => l.countInPolygon > 0;
    const rows: TableRow[] = [
      { label: "מקבץ שימושים ראשי - לאזור הייעוד", cells: col((r) => r.info.primaryUse) },
      { label: "מקבצי שימושים נוספים - לאזור הייעוד", cells: col((r) => r.info.extraUses) },
      { label: 'רח"ק לפי אזור הייעוד', cells: col((r) => r.info.far) },
      { label: "גובה מירבי", cells: col((r) => r.info.height) },
      { label: "הוראות מיוחדות", cells: col((r) => r.info.directives) },
      { label: "התראות מרחביות", cells: repeat(this.alertsText((l) => inPoly(l) && l.geometryType === "polygon")) },
      { label: "התראות קוויות", cells: repeat(this.alertsText((l) => inPoly(l) && l.geometryType === "polyline")) },
      { label: "התראות נקודתיות", cells: repeat(this.alertsText((l) => inPoly(l) && l.geometryType === "point")) },
      {
        label: "התראות מגורמים סמוכים",
        cells: repeat(this.alertsText((l) => l.count > 0 && l.countInPolygon === 0)),
      },
    ];

    const bottomNotes: string[] = [];
    const sources = results.filter((r): r is ZonePlanResult => !!r && !!r.info.source);
    if (sources.length) {
      bottomNotes.push(
        "מקור: תוכנית המתאר תא/5500 — " + sources.map((r) => `${r.info.zone} (${r.info.source})`).join("; "),
      );
    }
    const areaNotes = results.find((r) => r && r.areaNotes.length)?.areaNotes ?? [];
    if (areaCode) {
      bottomNotes.push(
        areaNotes.length
          ? `הוראות מיוחדות לאזור תכנון ${areaCode} (טבלה 5.4): ${areaNotes.join(" | ")}`
          : `אזור תכנון ${areaCode}`,
      );
    }
    if (usedZones.length === 0) bottomNotes.push("לא נמצאו ישויות בשכבות אזורי הייעוד בתחום שנבחר, או שלא זוהה שדה שם.");
    if (zones.length > usedZones.length) bottomNotes.push(`מוצגים ${usedZones.length} אזורי הייעוד הנפוצים מתוך ${zones.length}.`);
    const notFound = results.filter((r) => r && !r.info.found).map((r) => r!.info.zone);
    if (notFound.length) bottomNotes.push(`לא נמצאו בתוכנית הוראות עבור: ${notFound.join(", ")}`);
    if (errors.length) bottomNotes.push(`שגיאה בגישה ל-RAG: ${[...new Set(errors)][0]}`);
    bottomNotes.push(`תוצר אוטומטי לפי ${a.mode === "boundary" ? "גבול התכנית" : "הפוליגון שנבחר"} + באפר ${QUERY_BUFFER_METERS} מ׳ | ${new Date().toLocaleDateString("he-IL")}`);

    return composeTablePage({
      columns,
      rows,
      topNotes: [
        "* ההוראות המפורטות בטבלה מטה מהוות תמצית של ההנחיות לתחום הנבחר. ככל ההוראות המחייבות מפורטות במסמכי תכנית המתאר",
        "** ההתראות המפורטות מטה עשויות לשנות באופן מקומי את ההנחיות הכלליות המוצגות בטבלה",
      ],
      bottomNotes,
    });
  }
}

const PLAN_SYMBOL = {
  type: "simple-fill",
  color: [0, 0, 255, 0.05],
  outline: { color: [0, 0, 255, 1], width: 3 },
};
