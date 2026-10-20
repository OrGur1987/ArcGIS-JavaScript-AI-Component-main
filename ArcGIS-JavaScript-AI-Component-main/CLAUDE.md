# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

React 18 + Vite app embedding the ArcGIS Maps SDK 5.x (`@arcgis/map-components`), the ArcGIS AI Assistant web component (`@arcgis/ai-components`), and Calcite. Custom LangGraph agents plug into the assistant, and a local Express "MCP hub" (`hub/server.ts`) aggregates external MCP servers behind one JSON-RPC endpoint.

This fork is localized to **Hebrew / RTL**: `index.html` is `lang="he" dir="rtl"`, `App.tsx` calls `setLocale("he")`, and user-facing strings in components/hooks/agents are Hebrew. Keep new UI strings in Hebrew and keep layouts RTL-safe.

## Commands

```bash
npm install
npm run dev          # Vite dev server (port 5173, strictPort)
npm run hub          # MCP hub on :8808 (run in a second terminal; needed for MCP features)
npm run hub:dev      # hub with tsx --watch
npm run build        # vite build (does NOT type-check)
npm run preview      # serve the build on :4173
npx tsc --noEmit     # type-check src/ (tsconfig only includes src/, not hub/)
npm run test:local   # npx tsx tests/run-tests.ts
```

- There is no lint script and no test framework. `tests/` is gitignored on purpose (local-only harness), so it may not exist in a given checkout. It covers only the pure logic in `src/agents/mcpAgentCore.ts`.
- `?mode=edit` in the URL enables the wider assistant panel and the theme editor, which persists to `localStorage` (`src/hooks/useTheme.ts`).

### Dev server gotchas (`vite.config.ts`)

The dev config has machine-specific defaults that break `npm run dev` on other machines:
- HTTPS is **on by default** and reads a cert/key from `C:/dev/arcgis-experience-builder-1.18/server/cert/...`. If that file is missing, Vite crashes at startup. Set `VITE_DEV_HTTPS=false`, or set `VITE_DEV_HTTPS_CERT` / `VITE_DEV_HTTPS_KEY`.
- The host defaults to `hilar-lap.stltd.co.il`. Override it with `VITE_DEV_HOST=localhost`. `VITE_DEV_PORT` overrides the port.
- The ArcGIS OAuth credential's redirect URLs must match the actual dev origin (scheme + host + port).

### Config files (both gitignored, created from examples)

- `.env.local` from `.env.example`: `VITE_ARCGIS_OAUTH_APP_ID` (required), `VITE_ARCGIS_PORTAL_URL`, `VITE_APP_NAME`. Optional: `VITE_MCP_BASE_URL` (default `/api/mcp`), `VITE_MCP_PROXY_TARGET` (default `http://127.0.0.1:8808`).
- `mcp-hub.config.json` from `mcp-hub.config.example.json`. The hub prefers `mcp-hub.config.local.json` if present, or `--config <path>`. The hub **writes back** to this file when servers are added or edited through the UI. It holds API keys, so never commit it or copy its contents elsewhere.

## Architecture

### App shell
`src/App.tsx` is a thin orchestrator over four hooks: `useAuth` (ArcGIS OAuth / IdentityManager), `useWebMap` (load or create the WebMap and track readiness), `useAssistantSetup` (agent registration + map "embeddings"), and `useTheme`. Calcite and map/ai web components are registered one at a time by side-effect imports in `src/main.tsx`. Add an import there when you use a new `calcite-*` / `arcgis-*` element, and add it to `src/types/custom-elements.d.ts` for JSX typing.

### Custom assistant agents (`src/agents/`)
Each agent exports `registerXxxAgent(assistantEl, ...)`. The function:
1. builds an agent object `{ id, name, description, createGraph, workspace }`, where `createGraph` returns a LangGraph `StateGraph` imported from `@langchain/langgraph/web`, whose state has `messages` plus an `outputMessage` string that the assistant displays;
2. removes any existing `[data-agent-id=...]` child and appends a new `<arcgis-assistant-agent>` element with `.agent = agent`.

The assistant's router chooses an agent by its `description`, so description wording matters for routing. Several descriptions include explicit "do not use for X" clauses to prevent misroutes. Parameter extraction inside agents uses `invokeToolPrompt` from `@arcgis/ai-orchestrator` with a Zod-schema'd LangChain `tool` as a structured-output trick. `@arcgis/ai-orchestrator` and `@langchain/core` come in transitively through `@arcgis/ai-components`, not as direct dependencies.

`useAssistantSetup` re-registers all agents whenever the map becomes ready or `mcpHubRefreshToken` changes (bumped by the hub manager UI). To add an agent, add its register call there. `AllCapabilitiesAgent` lists the other agents by reading the DOM, so it picks up new ones automatically.

Cross-agent memory lives on `globalThis.__arcgisAssistantState__` (`src/utils/assistantState.ts`): the last geo result snapshot and the last created feature layer. For example, "add a feature to the last created layer" depends on it.

### MCP path
- **Hub** (`hub/server.ts`, runs in Node via tsx): connects to each configured server over stdio, Streamable HTTP, or SSE (with fallback). It exposes REST management at `/servers` (CRUD plus `/start` and `/stop`) and `/health`, and a minimal JSON-RPC surface (`initialize`, `tools/list`, `tools/call`) at `/` and `/mcp`. Tool names are namespaced as `<serverId>__<toolName>`, and the hub strips the prefix when it routes calls.
- **Vite proxy**: `/api/mcp` → hub. `/dev-mcp-relay/<http|https>/<host:port>/<path>` is a generic CORS-free relay to any MCP URL, and the passthrough agent rewrites absolute MCP URLs into this form. These proxies exist only in dev; `vite preview` and production builds have no proxy.
- **`McpPassthroughAgent.ts`**: discovers tools (cached for 5 minutes, hub server list cached for 60 seconds), converts each MCP `inputSchema` to Zod (`src/utils/mcpZodSchema.ts`), and runs an agent ⇄ tools loop capped at `MAX_MCP_TOOL_ROUNDS`. It then makes one LLM call (`extractAndSelectGeoEntities`) to pull place names out of the results and renders them on the map. Its description is refreshed from the live tool list (`refreshMcpAgentDescription`).
- **`mcpAgentCore.ts`**: the framework-free logic, covering URL normalization, prompt building, JSON/fenced-JSON parsing, geo-hint extraction, and entity dedupe/prioritization. It imports only *types* from the renderer. Keep it that way so the tsx test harness can run it in Node without ArcGIS or browser APIs.
- **`src/utils/mcpGeoRenderer.ts`**: geocodes entities (World Geocoder + boundaries services) and draws them into dedicated layers (`mcp-geo-results`, etc.). Popups come from the specific source records that mention each place, not from a generic summary.

### ArcGIS Online helpers
`src/utils/arcgisOnline.ts` handles portal REST calls: credentials, item search, WebMap create/save, hosted feature service creation, and the assistant "embeddings" generate/status calls that prepare a map for the built-in data-exploration agent. `src/utils/featureLayerEdits.ts` covers applyEdits and adding layers to the current map. `src/utils/arcgisMcp.ts` is a REST client for an optional ArcGIS-specific MCP backend (`/api/search/layers`, `/api/feature-table`, …).
