import React, { useRef } from "react";

interface Props {
  inputWebMapId: string;
  onLoadMap: (id: string) => void;
  onNewMap: () => void;
}

export function MapPickerScreen({ inputWebMapId, onLoadMap, onNewMap }: Props) {
  const inputRef = useRef<HTMLElement & { value?: string }>(null);

  const handleLoad = () => {
    const id = (inputRef.current?.value ?? inputWebMapId).trim();
    if (id) onLoadMap(id);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleLoad();
  };

  return (
    <div className="centered-screen">
      <div className="map-picker-panel">
        <calcite-panel heading="טעינת מפת אינטרנט">
          <div className="panel-body">
            <div className="map-picker-stack">
              <calcite-label>
                מזהה מפת אינטרנט
                <calcite-input
                  ref={inputRef}
                  placeholder="הזן מזהה פריט מפת אינטרנט"
                  clearable
                  onKeyDown={handleKeyDown}
                />
              </calcite-label>
              <calcite-button appearance="solid" kind="brand" width="full" onClick={handleLoad}>
                טען מפה
              </calcite-button>
              <calcite-button appearance="outline" width="full" onClick={onNewMap}>
                מפה חדשה
              </calcite-button>
              <p className="map-picker-hint">
                יצירת מפה חדשה יוצרת פריט מפת אינטרנט חדש ב-ArcGIS Online באופן מיידי, ולאחר מכן
                פותחת אותו כאן לעריכה.
              </p>
            </div>
          </div>
        </calcite-panel>
      </div>
    </div>
  );
}
