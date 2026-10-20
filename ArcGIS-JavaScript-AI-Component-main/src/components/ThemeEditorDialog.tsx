import React from "react";
import type { ThemeState } from "../hooks/useTheme";
import type { ThemeSnapshot } from "../hooks/useTheme";
import { HEADER_FONT_OPTIONS } from "../hooks/useTheme";

interface Props {
  open: boolean;
  theme: ThemeState;
  onDone: () => void;
  onCancel: (snapshot: ThemeSnapshot) => void;
  snapshotRef: React.RefObject<ThemeSnapshot | null>;
}

export function ThemeEditorDialog({ open, theme, onDone, onCancel, snapshotRef }: Props) {
  if (!open) return null;

  const handleCancel = () => {
    if (snapshotRef.current) {
      onCancel(snapshotRef.current);
    } else {
      onDone();
    }
  };

  return (
    <calcite-dialog
      open
      overlay-positioning="fixed"
      heading="עריכת ערכת נושא"
      width="m"
      onCalciteDialogClose={handleCancel}
    >
      <div className="theme-editor-dialog">
        <div className="theme-editor-grid theme-editor-grid--text">
          <label className="theme-editor-field theme-editor-field--wide">
            <span>כותרת</span>
            <input
              type="text"
              className="theme-editor-text-input"
              value={theme.headerTitle}
              placeholder="כותרת עליונה"
              onChange={(e) => theme.setHeaderTitle(e.target.value)}
            />
          </label>
          <label className="theme-editor-field theme-editor-field--wide">
            <span>כותרת משנה</span>
            <input
              type="text"
              className="theme-editor-text-input"
              value={theme.headerSubtitle}
              placeholder="כותרת משנה עליונה"
              onChange={(e) => theme.setHeaderSubtitle(e.target.value)}
            />
          </label>
          <label className="theme-editor-field theme-editor-field--wide">
            <span>גופן</span>
            <select
              className="theme-editor-text-input"
              value={theme.headerFontFamily}
              onChange={(e) => theme.setHeaderFontFamily(e.target.value)}
            >
              {HEADER_FONT_OPTIONS.map((opt) => (
                <option key={opt.label} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="theme-editor-section-label">כותרת עליונה</div>
        <div className="theme-editor-grid">
          <label className="theme-editor-color-field">
            <span>כותרת</span>
            <input type="color" value={theme.headerTextColor} onChange={(e) => theme.setHeaderTextColor(e.target.value)} />
          </label>
          <label className="theme-editor-color-field">
            <span>כותרת משנה</span>
            <input type="color" value={theme.headerSubtitleColor} onChange={(e) => theme.setHeaderSubtitleColor(e.target.value)} />
          </label>
          <label className="theme-editor-color-field">
            <span>רקע</span>
            <input
              type="color"
              value={theme.headerBackground.startsWith("#") ? theme.headerBackground : "#f6fbff"}
              onChange={(e) => theme.setHeaderBackground(e.target.value)}
            />
          </label>
          <label className="theme-editor-color-field">
            <span>מסגרת</span>
            <input type="color" value={theme.headerBorderColor} onChange={(e) => theme.setHeaderBorderColor(e.target.value)} />
          </label>
        </div>

        <div className="theme-editor-section-label">פאנל הצ'אט</div>
        <div className="theme-editor-grid theme-editor-grid--text">
          <label className="theme-editor-field theme-editor-field--wide">
            <span>כותרת הפאנל</span>
            <input
              type="text"
              className="theme-editor-text-input"
              value={theme.chatPanelTitle}
              placeholder="כותרת פאנל הצ'אט"
              onChange={(e) => theme.setChatPanelTitle(e.target.value)}
            />
          </label>
        </div>
        <div className="theme-editor-grid">
          <label className="theme-editor-color-field">
            <span>רקע</span>
            <input type="color" value={theme.chatPanelBackground} onChange={(e) => theme.setChatPanelBackground(e.target.value)} />
          </label>
          <label className="theme-editor-color-field">
            <span>כותרת + קלט</span>
            <input type="color" value={theme.chatChromeColor} onChange={(e) => theme.setChatChromeColor(e.target.value)} />
          </label>
          <label className="theme-editor-color-field">
            <span>צ'אט</span>
            <input type="color" value={theme.chatMessageColor} onChange={(e) => theme.setChatMessageColor(e.target.value)} />
          </label>
          <label className="theme-editor-color-field">
            <span>מסגרת</span>
            <input type="color" value={theme.chatPanelBorderColor} onChange={(e) => theme.setChatPanelBorderColor(e.target.value)} />
          </label>
        </div>
      </div>

      <calcite-button slot="footer-start" appearance="outline" kind="neutral" onClick={handleCancel}>
        ביטול
      </calcite-button>
      <calcite-button slot="footer-end" appearance="solid" kind="brand" onClick={onDone}>
        סיום
      </calcite-button>
    </calcite-dialog>
  );
}
