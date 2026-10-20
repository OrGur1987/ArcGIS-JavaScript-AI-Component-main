import { useCallback, useEffect, useRef, useState } from "react";
import { getCredential, generateAndSaveWebMapEmbeddings, getWebMapEmbeddingsStatus } from "../utils/arcgisOnline";
import {
  refreshMcpAgentDescription,
  registerMcpPassthroughAgent,
} from "../agents/McpPassthroughAgent";
import { registerCreateFeatureLayerAgent } from "../agents/CreateFeatureLayerAgent";
import { registerManageFeatureLayerAgent } from "../agents/ManageFeatureLayerAgent";
import { registerFeatureLayerCapabilitiesAgent } from "../agents/AllCapabilitiesAgent";
import { registerAddLayerToMapAgent } from "../agents/AddLayerToMapAgent";

function toAssistantPreparationErrorMessage(message: string): string {
  if (/eligible layers or fields|generate embeddings|embedding/i.test(message)) {
    return "למפה הזו אין עדיין נתונים נתמכים להגדרת העוזר.";
  }
  return message.replace(/embeddings?/gi, "assistant data");
}

export interface AssistantSetupState {
  isAssistantPrepared: boolean;
  isEmbeddingBusy: boolean;
  embeddingsStatusMessage: string | null;
  embeddingsError: string | null;
  showEmbeddingRegenerateButton: boolean;
  setShowEmbeddingRegenerateButton: React.Dispatch<React.SetStateAction<boolean>>;
  ensureEmbeddings: (forceRegenerate?: boolean) => Promise<void>;
  mcpHubRefreshToken: number;
  refreshMcpHub: () => void;
}

export function useAssistantSetup(
  webMapId: string,
  isMapReady: boolean,
  mapHasOperationalData: boolean,
  mapLoadError: string | null,
  isSignedIn: boolean,
  oauthClientId: string | undefined,
  portalUrl: string,
  mcpBaseUrl: string,
): AssistantSetupState {
  const [isAssistantPrepared, setIsAssistantPrepared] = useState(false);
  const [isEmbeddingBusy, setIsEmbeddingBusy] = useState(false);
  const [embeddingsStatusMessage, setEmbeddingsStatusMessage] = useState<string | null>(null);
  const [embeddingsError, setEmbeddingsError] = useState<string | null>(null);
  const [showEmbeddingRegenerateButton, setShowEmbeddingRegenerateButton] = useState(false);
  const [mcpHubRefreshToken, setMcpHubRefreshToken] = useState(0);

  const autoCheckedMapIdRef = useRef<string | null>(null);

  const refreshMcpHub = useCallback(() => {
    setMcpHubRefreshToken((v) => v + 1);
  }, []);

  // Reset assistant state when webMapId changes
  useEffect(() => {
    setIsAssistantPrepared(false);
    setEmbeddingsStatusMessage(null);
    setEmbeddingsError(null);
    autoCheckedMapIdRef.current = null;
  }, [webMapId]);

  // Register all custom agents on the assistant element when map is ready
  useEffect(() => {
    if (!webMapId || !isMapReady) return;
    const assistant = document.querySelector("arcgis-assistant") as HTMLElement | null;
    if (!assistant) return;

    registerCreateFeatureLayerAgent(assistant, { oauthClientId, portalUrl, layerName: "Locations" });
    registerManageFeatureLayerAgent(assistant);
    registerAddLayerToMapAgent(assistant);
    registerFeatureLayerCapabilitiesAgent(assistant);
    registerMcpPassthroughAgent(assistant, { baseUrl: mcpBaseUrl, serverName: "MCP Hub" });
    void refreshMcpAgentDescription(assistant);
  }, [webMapId, isMapReady, mcpHubRefreshToken, oauthClientId, portalUrl, mcpBaseUrl]);

  const ensureEmbeddings = useCallback(
    async (forceRegenerate = false) => {
      if (!webMapId || !mapHasOperationalData) {
        setIsEmbeddingBusy(false);
        setIsAssistantPrepared(false);
        setEmbeddingsStatusMessage(null);
        setEmbeddingsError(null);
        return;
      }

      setEmbeddingsError(null);
      setIsAssistantPrepared(false);
      setIsEmbeddingBusy(true);

      try {
        const cred = await getCredential(oauthClientId, portalUrl);

        if (!forceRegenerate) {
          setEmbeddingsStatusMessage("מכין את העוזר עבור המפה הזו...");
          const status = await getWebMapEmbeddingsStatus(portalUrl, cred.token, webMapId);
          if (status.exists) {
            setIsAssistantPrepared(true);
            setEmbeddingsStatusMessage("העוזר מוכן עבור המפה הזו.");
            autoCheckedMapIdRef.current = webMapId;
            return;
          }
        }

        setEmbeddingsStatusMessage(
          forceRegenerate
            ? "מרענן את נתוני העוזר עבור המפה הזו..."
            : "מכין את נתוני העוזר עבור המפה הזו...",
        );

        const result = await generateAndSaveWebMapEmbeddings({
          portalUrl,
          token: cred.token,
          webMapItemId: webMapId,
          removeExisting: true,
        });

        if (!result.success) throw new Error(result.message || "יצירת נתוני העוזר נכשלה.");

        setIsAssistantPrepared(true);
        setEmbeddingsStatusMessage("העוזר מוכן עבור המפה הזו.");
        autoCheckedMapIdRef.current = webMapId;
      } catch (error: unknown) {
        setIsAssistantPrepared(false);
        const raw = error instanceof Error ? error.message : "לא ניתן להכין את העוזר עבור המפה הזו.";
        setEmbeddingsError(toAssistantPreparationErrorMessage(raw));
        setEmbeddingsStatusMessage(null);
      } finally {
        setIsEmbeddingBusy(false);
      }
    },
    [webMapId, mapHasOperationalData, oauthClientId, portalUrl],
  );

  // Auto-trigger embedding check when the map is ready with data
  useEffect(() => {
    if (!isSignedIn || !webMapId || !isMapReady || mapLoadError || !mapHasOperationalData) return;
    if (autoCheckedMapIdRef.current === webMapId) return;
    void ensureEmbeddings(false);
  }, [webMapId, ensureEmbeddings, isMapReady, isSignedIn, mapHasOperationalData, mapLoadError]);

  return {
    isAssistantPrepared,
    isEmbeddingBusy,
    embeddingsStatusMessage,
    embeddingsError,
    showEmbeddingRegenerateButton,
    setShowEmbeddingRegenerateButton,
    ensureEmbeddings,
    mcpHubRefreshToken,
    refreshMcpHub,
  };
}
