import React from "react";
import mcpServerIcon from "../../mcpicon.png";
import { ASSISTANT_DESCRIPTION } from "./AssistantPanel";

const mcpIconStyle: React.CSSProperties = {
  width: "22px",
  height: "22px",
  display: "block",
  backgroundColor: "#007ac2",
  WebkitMaskImage: `url(${mcpServerIcon})`,
  maskImage: `url(${mcpServerIcon})`,
  WebkitMaskRepeat: "no-repeat",
  maskRepeat: "no-repeat",
  WebkitMaskPosition: "center",
  maskPosition: "center",
  WebkitMaskSize: "contain",
  maskSize: "contain",
};

const actionButtonScale = "m" as const;

export interface AppHeaderProps {
  /** Rendered title text */
  headerTitle: string;
  /** Rendered subtitle text. Pass null or empty to hide. */
  headerSubtitle: string;
  /** CSS font-family for title/subtitle */
  headerFontFamily: string;
  /** CSS background (gradient or hex) for the header bar — unused in the glass design, kept for theme-editor compatibility */
  headerBackground: string;
  /** CSS color for the bottom border — unused in the glass design, kept for theme-editor compatibility */
  headerBorderColor: string;
  /** CSS color for the title */
  headerTextColor: string;
  /** CSS color for the subtitle */
  headerSubtitleColor: string;
  /** Whether the session is signed in and the actions should be shown */
  isSignedIn: boolean;
  /** Whether the map picker / startup screen is showing (hides title copy) */
  isStartupPage: boolean;
  /** App mode — "edit" enables the theme-editor button */
  appMode: "default" | "edit";
  /** Currently loaded WebMap item ID (empty string = none) */
  webMapId: string;
  /** Show the hidden "regenerate embeddings" button */
  showEmbeddingRegenerateButton: boolean;
  /** Whether an embedding operation is in flight */
  isEmbeddingBusy: boolean;
  /** Slot for the account dropdown rendered by the parent */
  accountMenuSlot: React.ReactNode;
  onOpenThemeEditor: () => void;
  onChangeWebMap: () => void;
  onRegenerateEmbeddings: () => void;
  /** Click handler for the MCP button; receives the native mouse event */
  onMcpButtonClick: (event: MouseEvent) => void;
}

/**
 * Floating glass command header, rendered above the full-bleed map.
 */
export function AppHeader({
  headerFontFamily,
  headerTextColor,
  isSignedIn,
  isStartupPage,
  appMode,
  webMapId,
  showEmbeddingRegenerateButton,
  isEmbeddingBusy,
  accountMenuSlot,
  onOpenThemeEditor,
  onChangeWebMap,
  onRegenerateEmbeddings,
  onMcpButtonClick,
}: AppHeaderProps) {
  const shouldShowActions = isSignedIn;

  return (
    <header className="ds-header">
      <div className="ds-header-border">
        <div className="ds-header-inner">
          <div className="ds-spark">
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3c.4 4 1.6 5.2 5.6 5.6C13.6 9 12.4 10.2 12 14c-.4-3.8-1.6-5-5.6-5.4C10.4 8.2 11.6 7 12 3Z" />
            </svg>
          </div>

          {!isStartupPage && (
            <div className="ds-header-text">
              <span className="ds-header-eyebrow">
                ArcGIS Maps SDK for JavaScript · <span className="ds-eyebrow-latin">Systematics</span>
              </span>
              <span
                className="ds-header-title"
                style={{ color: headerTextColor, fontFamily: headerFontFamily }}
              >
                {ASSISTANT_DESCRIPTION}
              </span>
            </div>
          )}

          <span className="ds-spacer" />

          {shouldShowActions && !isStartupPage && (
            <div className="app-header-actions">
              {appMode === "edit" && (
                <calcite-button
                  appearance="transparent"
                  icon-start="pencil"
                  scale={actionButtonScale}
                  title="עריכת ערכת נושא"
                  aria-label="עריכת ערכת נושא"
                  className="app-header-icon-button"
                  onClick={onOpenThemeEditor}
                />
              )}

              <calcite-button
                appearance="transparent"
                icon-start="map"
                scale={actionButtonScale}
                title={webMapId ? "החלפת מפת אינטרנט" : "טעינת מפת אינטרנט"}
                aria-label={webMapId ? "החלפת מפת אינטרנט" : "טעינת מפת אינטרנט"}
                className="app-header-icon-button"
                onClick={onChangeWebMap as any}
              />

              {showEmbeddingRegenerateButton && webMapId && (
                <calcite-button
                  appearance="transparent"
                  icon-start="reset"
                  scale={actionButtonScale}
                  className="app-header-icon-button"
                  title="רענון נתוני העוזר"
                  aria-label="רענון נתוני העוזר"
                  onClick={() => {
                    if (!isEmbeddingBusy) onRegenerateEmbeddings();
                  }}
                />
              )}

              <calcite-button
                appearance="transparent"
                scale={actionButtonScale}
                title="ניהול שרתי MCP"
                aria-label="ניהול שרתי MCP"
                className="app-header-icon-button"
                onClick={(event: any) => onMcpButtonClick(event?.nativeEvent ?? event)}
              >
                <span aria-hidden="true" style={mcpIconStyle} />
              </calcite-button>

              {accountMenuSlot}
            </div>
          )}

          <span className="ds-live-badge">
            <span className="ds-live-dot" />
            LIVE
          </span>
        </div>
      </div>
    </header>
  );
}
