import React, { useEffect, useRef } from "react";
import { installAssistantUserBubbleStyler } from "../utils/assistantStyler";

// ── Hebrew assistant copy ────────────────────────────────────────────────────

export const ASSISTANT_DESCRIPTION = "תחקור שכבות המפה ומקורות מידע חיצוניים בשפה יומיומית";
// ArcGIS's own docs say `heading` "should be concise" — it's a short label slot,
// not a sentence, and long values get visually truncated by the component itself.
const ASSISTANT_HEADING = "עוזר אישי לרשותך לתחקור המפה וסיכום עיקרי החדשות";
const ASSISTANT_ENTRY_MESSAGE =
  "שלום! אני יכול לעזור לך לסייר ולנתח את נתוני המפה.\n\nנסה לשאול על שכבות, סטטיסטיקות, או לנווט לכל מיקום.";
const ASSISTANT_SUGGESTED_PROMPTS = [
  "אילו שכבות יש במפה?",
  "כמה ישויות יש בשכבה הראשונה?",
  "מה אני יכול לשאול אותך?",
];

interface AssistantElement extends HTMLElement {
  heading?: string;
  description?: string;
  entryMessage?: string;
  suggestedPrompts?: string[];
  clearChatHistory?: () => Promise<void>;
}

// ── Component ─────────────────────────────────────────────────────────────────

export interface AssistantPanelProps {
  webMapId: string;
  mcpHubRefreshToken: number;
  isMapReady: boolean;
  mapLoadError: string | null;
  mapHasOperationalData: boolean;
  isAssistantPrepared: boolean;
  embeddingsStatusMessage: string | null;
  embeddingsError: string | null;
  chatPanelTitle: string;
  chatPanelBackground: string;
  chatChromeColor: string;
  chatMessageColor: string;
  chatPanelBorderColor: string;
  showEmptyMapAssistantNotice: boolean;
  onDismissEmptyMapNotice: () => void;
}

/**
 * The floating glass AI panel: a card overlaid on the map containing the
 * arcgis-assistant element plus status/error messages and an empty-map notice.
 */
export function AssistantPanel({
  webMapId,
  mcpHubRefreshToken,
  isMapReady,
  mapLoadError,
  mapHasOperationalData,
  isAssistantPrepared,
  embeddingsStatusMessage,
  embeddingsError,
  chatPanelBackground,
  chatChromeColor,
  chatMessageColor,
  chatPanelBorderColor,
  showEmptyMapAssistantNotice,
  onDismissEmptyMapNotice,
}: AssistantPanelProps) {
  const assistantRef = useRef<AssistantElement>(null);

  // Install the bubble-styler / link opener whenever the assistant is rendered
  useEffect(() => {
    if (!isMapReady || mapLoadError) return;

    const assistant = document.querySelector(
      "arcgis-assistant",
    ) as HTMLElement | null;
    if (!assistant) return;

    return installAssistantUserBubbleStyler(assistant);
  }, [webMapId, isMapReady, mapLoadError]);

  // Push Hebrew heading/description/entry message/suggested prompts onto the
  // assistant element as DOM properties (suggestedPrompts is an array, so it
  // can't be passed as a plain JSX attribute).
  const applyAssistantCopy = () => {
    const el = assistantRef.current;
    if (!el) return;
    el.heading = ASSISTANT_HEADING;
    el.description = ASSISTANT_DESCRIPTION;
    el.entryMessage = ASSISTANT_ENTRY_MESSAGE;
    el.suggestedPrompts = ASSISTANT_SUGGESTED_PROMPTS;
  };

  // Applying these properties once is unreliable: the custom element isn't
  // always fully upgraded/ready yet right when we set them (worse on a
  // cold/uncached load, e.g. incognito, or right after clearChatHistory()
  // resets internal state), so the assignment can silently get dropped and
  // the component falls back to its own default ("עוזר"). Retry a few times
  // to self-heal.
  const applyAssistantCopyWithRetries = () => {
    applyAssistantCopy();
    const retryDelays = [50, 150, 300, 600, 1000];
    const timers = retryDelays.map((delay) => setTimeout(applyAssistantCopy, delay));
    return () => timers.forEach(clearTimeout);
  };

  useEffect(() => applyAssistantCopyWithRetries(), [webMapId, mcpHubRefreshToken]);

  const handleNewChat = async () => {
    await assistantRef.current?.clearChatHistory?.();
    // clearChatHistory() also resets heading/description/entryMessage/suggestedPrompts,
    // so they need to be reapplied afterward or the greeting screen renders blank.
    applyAssistantCopyWithRetries();
  };

  const shouldRenderAssistant = isMapReady && !mapLoadError;

  return (
    <div className="ds-panel" id="assistant-panel">
      <div className="ds-glass-border">
        <div className="ds-glass-inner">
          <div className="ds-panel-strip">
            <span className="ds-eyebrow">עוזר AI גיאוגרפי ומעודכן בחדשות הכי חמות</span>
            <span className="ds-spacer" />
            <span className="ds-live-dot" />
          </div>
          <div className="ds-panel-body">
            <div
              className="chat-panel-theme"
              style={{
                backgroundColor: chatPanelBackground,
                color: chatMessageColor,
                borderColor: chatPanelBorderColor,
              }}
            >
              {mapLoadError ? (
                <calcite-notice open kind="danger">
                  <div slot="title">טעינת המפה נכשלה</div>
                  <div slot="message">{mapLoadError}</div>
                </calcite-notice>
              ) : !isMapReady ? (
                <calcite-notice open kind="info">
                  <div slot="title">טוען מפה</div>
                  <div slot="message">העוזר יופיע לאחר שתצוגת מפת האינטרנט תהיה מוכנה.</div>
                </calcite-notice>
              ) : (
                <>
                  {!mapHasOperationalData && showEmptyMapAssistantNotice && (
                    <calcite-notice open kind="info" closable onCalciteNoticeClose={onDismissEmptyMapNotice}>
                      <div slot="message">
                        המפה הזו ריקה, ולכן ניווט במפה וחקר נתונים מושבתים עד שיתווספו שכבות או טבלאות.
                        תהליכי עבודה מבוססי MCP ותהליכים מותאמים אישית עדיין זמינים.
                      </div>
                    </calcite-notice>
                  )}

                  {mapHasOperationalData && !isAssistantPrepared && !embeddingsError && (
                    <calcite-notice open kind="info">
                      <div slot="title">מכין כלי עוזר מודעי-מפה</div>
                      <div slot="message">
                        {embeddingsStatusMessage ||
                          "נתוני העוזר הספציפיים למפה עדיין בהכנה. תהליכי עבודה מבוססי MCP ותהליכים מותאמים אישית עדיין זמינים."}
                      </div>
                    </calcite-notice>
                  )}

                  {shouldRenderAssistant && (
                    <arcgis-assistant
                      key={`${webMapId || "no-map"}:${mcpHubRefreshToken}`}
                      ref={assistantRef}
                      reference-element="#main-map"
                      class="chat-panel-theme__assistant"
                      style={{
                        backgroundColor: chatPanelBackground,
                        color: chatMessageColor,
                        border: "none",
                        borderRadius: "14px",
                        padding: 0,
                        ["--app-chat-panel-bg" as string]: chatPanelBackground,
                        ["--app-chat-chrome-text" as string]: chatChromeColor,
                        ["--app-chat-message-text" as string]: chatMessageColor,
                        ["--app-chat-panel-border" as string]: chatPanelBorderColor,
                      } as React.CSSProperties}
                    >
                      <calcite-action
                        slot="header-actions-end"
                        icon="reset"
                        text="שיחה חדשה"
                        title="שיחה חדשה"
                        onClick={() => void handleNewChat()}
                      ></calcite-action>
                      <arcgis-assistant-help-agent></arcgis-assistant-help-agent>
                      <arcgis-assistant-navigation-agent></arcgis-assistant-navigation-agent>
                      <arcgis-assistant-data-exploration-agent></arcgis-assistant-data-exploration-agent>
                      {/* Custom agents are appended programmatically by useAssistantSetup */}
                    </arcgis-assistant>
                  )}
                </>
              )}

              {embeddingsError && (
                <calcite-notice open kind="danger">
                  <div slot="message">{embeddingsError}</div>
                </calcite-notice>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
