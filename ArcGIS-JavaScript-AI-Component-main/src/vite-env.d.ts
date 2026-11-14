/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_OPENAI_API_KEY?: string;
  readonly VITE_ARCGIS_OAUTH_APP_ID?: string;
  readonly VITE_ARCGIS_PORTAL_URL?: string;
  readonly VITE_APP_NAME?: string;
  /** Web map item id loaded on sign-in when no last map is stored */
  readonly VITE_DEFAULT_WEBMAP_ID?: string;
  /** Preferred MCP hub base URL (replaces the legacy name below) */
  readonly VITE_MCP_BASE_URL?: string;
  /** Legacy alias – kept for backwards compatibility */
  readonly VITE_ARCGIS_MCP_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
