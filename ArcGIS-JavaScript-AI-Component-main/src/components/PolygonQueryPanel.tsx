import React, { useEffect, useRef, useState } from "react";
import { loadGisCodes } from "../agents/McpPassthroughAgent";
import { resolveArcgisMcpBaseUrl } from "../utils/arcgisMcp";
import { clearFocus, setFocusPolygon } from "../utils/focusStore";
import {
  PolygonGroupQueryController,
  QUERY_BUFFER_METERS,
  type BoundaryLayerOption,
  type PolygonQueryResult,
} from "../utils/polygonGroupQuery";

interface PolygonQueryPanelProps {
  mapElementRef: React.RefObject<HTMLElement & Record<string, unknown>>;
  isMapReady: boolean;
  webMapId: string;
}

type ExportChoice = "manual" | "boundary";

/**
 * Draw a polygon → 100 m buffer → open the 5 planning layer groups with the layers that are
 * relevant to it, and export the planning-info sheet (PDF) for a drawn polygon or for the
 * whole plan boundary (see utils/polygonGroupQuery.ts).
 */
export function PolygonQueryPanel({ mapElementRef, isMapReady, webMapId }: PolygonQueryPanelProps) {
  const controllerRef = useRef<PolygonGroupQueryController | null>(null);
  /** Set when the export was chosen before the area exists: export runs once the analysis finishes. */
  const exportAfterDrawRef = useRef(false);
  const [drawing, setDrawing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PolygonQueryResult | null>(null);
  const [exporting, setExporting] = useState<string | null>(null);
  // Layer visibility is mutated on the map; this just forces a re-render of the checkboxes.
  const [visibility, setVisibility] = useState<Record<string, boolean>>({});

  const [dialogOpen, setDialogOpen] = useState(false);
  const [choice, setChoice] = useState<ExportChoice>("manual");
  const [boundaryLayers, setBoundaryLayers] = useState<BoundaryLayerOption[]>([]);
  const [boundaryKey, setBoundaryKey] = useState("");

  const runExport = async () => {
    const controller = controllerRef.current;
    if (!controller) return;
    setError(null);
    setExporting("מתחיל…");
    try {
      await controller.exportInfoSheet((msg) => setExporting(msg));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setExporting(null);
    }
  };
  const runExportRef = useRef(runExport);
  runExportRef.current = runExport;

  useEffect(() => {
    const view = (mapElementRef.current as any)?.view;
    if (!isMapReady || !view?.map) return;

    const controller = new PolygonGroupQueryController(
      view,
      (r) => {
        setResult(r);
        setError(null);
        setVisibility(Object.fromEntries(r.groups.flatMap((g) => g.layers.map((l) => [l.id, l.visible]))));
        if (exportAfterDrawRef.current) {
          exportAfterDrawRef.current = false;
          void runExportRef.current();
        }
      },
      setBusy,
      (msg) => {
        exportAfterDrawRef.current = false;
        setError(msg);
      },
      setDrawing,
    );
    controllerRef.current = controller;

    return () => {
      controller.destroy();
      controllerRef.current = null;
      setResult(null);
      setDrawing(false);
      setBusy(false);
    };
  }, [isMapReady, webMapId, mapElementRef]);

  // A drawn polygon becomes the assistant's focus; any other state (cleared, boundary mode) drops it.
  useEffect(() => {
    const polygon = result?.mode === "manual" ? controllerRef.current?.getPolygon() : null;
    if (polygon) void setFocusPolygon(polygon, () => loadGisCodes(resolveArcgisMcpBaseUrl()));
    else clearFocus();
  }, [result]);

  if (!isMapReady) return null;

  const handleDraw = () => {
    setResult(null);
    setError(null);
    exportAfterDrawRef.current = false;
    if (drawing) controllerRef.current?.cancelDrawing();
    else controllerRef.current?.startDrawing();
  };

  const handleClear = () => {
    controllerRef.current?.clear();
    exportAfterDrawRef.current = false;
    setResult(null);
    setError(null);
    setDrawing(false);
  };

  const toggleLayer = (id: string, visible: boolean) => {
    controllerRef.current?.setLayerVisible(id, visible);
    setVisibility((prev) => ({ ...prev, [id]: visible }));
  };

  const openExportDialog = () => {
    const options = controllerRef.current?.listPolygonLayers() ?? [];
    setBoundaryLayers(options);
    setBoundaryKey(options[0]?.key ?? "");
    setChoice(result?.mode === "boundary" ? "boundary" : "manual");
    setDialogOpen(true);
  };

  const confirmExport = () => {
    const controller = controllerRef.current;
    if (!controller) return;
    setDialogOpen(false);
    setError(null);
    if (choice === "boundary") {
      exportAfterDrawRef.current = true;
      void controller.analyzeBoundary(boundaryKey);
    } else if (result?.mode === "manual") {
      void runExport(); // reuse the polygon that is already on the map
    } else {
      // No manual polygon yet: let the user draw one, then export automatically.
      setResult(null);
      exportAfterDrawRef.current = true;
      controller.startDrawing();
    }
  };

  const working = busy || !!exporting;

  return (
    <div className="pq-panel" dir="rtl">
      <div className="pq-actions">
        <calcite-button
          icon-start={drawing ? "x" : "polygon"}
          kind={drawing ? "neutral" : "brand"}
          loading={busy ? true : undefined}
          onClick={handleDraw}
        >
          {drawing ? "ביטול ציור" : "צייר פוליגון לשאילתה"}
        </calcite-button>
        {(result || error) && (
          <calcite-button appearance="outline" kind="neutral" icon-start="trash" onClick={handleClear}>
            נקה
          </calcite-button>
        )}
      </div>
      <calcite-button
        width="full"
        appearance="outline"
        icon-start="file-pdf"
        loading={exporting ? true : undefined}
        disabled={working || drawing ? true : undefined}
        onClick={openExportDialog}
      >
        ייצוא דף מידע מתארי (PDF)
      </calcite-button>

      {drawing && <p className="pq-hint">לחץ על המפה להוספת קודקודים. לחיצה כפולה מסיימת את הפוליגון.</p>}
      {busy && <p className="pq-hint">מבצע שאילתה מרחבית (באפר {QUERY_BUFFER_METERS} מ׳)…</p>}
      {exporting && <p className="pq-hint">{exporting}</p>}
      {error && <p className="pq-error">{error}</p>}

      {result && (
        <div className="pq-groups">
          <p className="pq-hint">
            תוצאות ל{result.mode === "boundary" ? "גבול התכנית" : "פוליגון"} + באפר {QUERY_BUFFER_METERS} מ׳
          </p>
          {result.groups.map((g) => (
            <details key={g.key} className="pq-group" open={g.found && g.layers.some((l) => l.count > 0)}>
              <summary>
                {g.label}
                {g.found && <span className="pq-badge">{g.layers.filter((l) => l.count > 0).length}</span>}
              </summary>
              {!g.found && <p className="pq-empty">לא נמצאה קבוצת שכבות בשם זה במפה</p>}
              {g.found && g.layers.length === 0 && <p className="pq-empty">אין שכבות בקבוצה</p>}
              {g.layers.map((l) => (
                <label key={l.id} className={`pq-layer${l.count === 0 ? " pq-layer--none" : ""}`}>
                  <input
                    type="checkbox"
                    checked={visibility[l.id] ?? false}
                    onChange={(e) => toggleLayer(l.id, e.target.checked)}
                  />
                  <span className="pq-layer-title">{l.title}</span>
                  <span className="pq-count">{l.count}</span>
                </label>
              ))}
            </details>
          ))}
        </div>
      )}

      {dialogOpen && (
        <calcite-dialog
          open
          modal
          overlay-positioning="fixed"
          heading="ייצוא דף מידע מתארי"
          onCalciteDialogClose={() => setDialogOpen(false)}
        >
          <div dir="rtl" className="pq-dialog">
            <p>על איזה אזור לייצא את הדף?</p>
            <label className="pq-choice">
              <input type="radio" name="pq-choice" checked={choice === "manual"} onChange={() => setChoice("manual")} />
              <span>
                <b>פוליגון ידני</b>
                <br />
                {result?.mode === "manual"
                  ? "הפוליגון שציירת כרגע"
                  : "תצייר פוליגון על המפה והייצוא יתחיל מיד אחריו"}
              </span>
            </label>
            <label className="pq-choice">
              <input
                type="radio"
                name="pq-choice"
                checked={choice === "boundary"}
                onChange={() => setChoice("boundary")}
                disabled={boundaryLayers.length === 0}
              />
              <span>
                <b>כל גבול התכנית</b>
                <br />
                עם באפר חיצוני של {QUERY_BUFFER_METERS} מ׳
              </span>
            </label>
            {choice === "boundary" && (
              <div className="pq-boundary">
                {boundaryLayers.length === 0 ? (
                  <p className="pq-error">לא נמצאו שכבות פוליגון במפה</p>
                ) : (
                  <label>
                    שכבת גבול התכנית:
                    <select value={boundaryKey} onChange={(e) => setBoundaryKey(e.target.value)}>
                      {boundaryLayers.map((l) => (
                        <option key={l.key} value={l.key}>
                          {l.title}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </div>
            )}
          </div>
          <calcite-button slot="footer-start" appearance="outline" kind="neutral" onClick={() => setDialogOpen(false)}>
            ביטול
          </calcite-button>
          <calcite-button
            slot="footer-end"
            onClick={confirmExport}
            disabled={choice === "boundary" && !boundaryKey ? true : undefined}
          >
            {choice === "manual" && result?.mode !== "manual" ? "צייר פוליגון" : "ייצוא"}
          </calcite-button>
        </calcite-dialog>
      )}
    </div>
  );
}
