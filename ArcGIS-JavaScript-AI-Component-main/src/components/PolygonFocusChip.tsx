import React from "react";
import { usePolygonFocus } from "../hooks/usePolygonFocus";
import { setFocusEnabled } from "../utils/focusStore";

/** Extent factor for the zoom: the polygon takes about 1/ZOOM_PADDING of the view. */
const ZOOM_PADDING = 3;

interface PolygonFocusChipProps {
  mapElementRef: React.RefObject<HTMLElement & Record<string, unknown>>;
}

/** The drawn polygon as a chip: the label zooms to it, the +/X toggles its use as the query filter. */
export function PolygonFocusChip({ mapElementRef }: PolygonFocusChipProps) {
  const focus = usePolygonFocus();
  if (!focus.polygon) return null;

  const zoomToPolygon = () => {
    const extent = focus.polygon?.extent;
    const view = (mapElementRef.current as any)?.view;
    if (extent && view) void view.goTo(extent.clone().expand(ZOOM_PADDING)).catch(() => {});
  };

  const label =
    focus.status === "loading" ? "מחשב חיתוך…" : focus.status === "error" ? "שגיאה בחישוב החיתוך" : "פוליגון לבדיקה";

  return (
    <div className={`pq-chip${focus.enabled ? " pq-chip--on" : ""}`} dir="rtl">
      <button type="button" className="pq-chip-main" onClick={zoomToPolygon}>
        {label}
      </button>
      <button
        type="button"
        className="pq-chip-toggle"
        disabled={focus.status !== "ready"}
        title={focus.enabled ? "לא להשתמש בפוליגון כמסנן בשאילתה" : "להשתמש בפוליגון כמסנן בשאילתה"}
        onClick={() => setFocusEnabled(!focus.enabled)}
      >
        <calcite-icon icon={focus.enabled ? "x" : "plus"} scale="s" />
      </button>
    </div>
  );
}
