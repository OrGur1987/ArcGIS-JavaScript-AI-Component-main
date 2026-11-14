# ArcGIS Agent Components Demo

React + Vite app built with ArcGIS Maps SDK, ArcGIS Assistant components, and an MCP hub.

The setup steps below include command equivalents for macOS, Linux, and Windows to reduce shell-specific onboarding errors.

## Quick Start (Brand New Computer, Nothing Installed)

Follow this if the machine has no dev tools at all yet. It only covers getting the tools installed — see [Local Setup](#local-setup) below for cloning and configuring this specific app.

1. **Install Git**
   - Windows: download and run the installer from [git-scm.com](https://git-scm.com/download/win), accepting the defaults.
   - macOS: run `git --version` in Terminal — this prompts to install the Xcode Command Line Tools if Git is missing.
   - Linux (Debian/Ubuntu): `sudo apt-get update && sudo apt-get install -y git`
2. **Install Node.js 18+** (includes `npm`)
   - Windows/macOS: download the **LTS** installer from [nodejs.org](https://nodejs.org/) and run it, accepting the defaults.
   - Linux: install via [nvm](https://github.com/nvm-sh/nvm) (`curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash`, restart the shell, then `nvm install --lts`).
3. **Verify the installs** in a new terminal/PowerShell window:
   ```bash
   git --version
   node --version   # should print v18 or higher
   npm --version
   ```
4. **Continue with [Local Setup](#local-setup)** below: clone the repo, run `npm install`, configure `.env.local` and ArcGIS OAuth, then `npm run dev`.

## Video Walkthrough

[![Watch the video walkthrough: Agentic GIS Meets MCP: Building an ArcGIS AI App](https://img.youtube.com/vi/fz4QGr099ws/hqdefault.jpg)](https://youtu.be/fz4QGr099ws)

This video walks through local setup, authorization, running the app, ArcGIS agents, and MCP integration.

## Disclaimer

Most of this app has been vibe coded with various coding agents. Review the code, configuration, and deployment choices before using it beyond demos or internal experimentation.

## What It Does

- Sign in with ArcGIS and load an existing WebMap or create a new one.
- Use built-in map-aware assistant tools for navigation and data exploration.
- Use MCP-backed tools for external workflows such as weather, catalog, or custom server tasks.
- Render MCP geography on the map when results include places, ranked city lists, or bounding boxes — each map pin shows a popup sourced from the specific article or record that mentioned that place, not a generic summary.
- Create and manage hosted feature layers from assistant results.
- Customise the app header and chat panel via the theme editor (`?mode=edit`) — changes persist across browser refreshes via `localStorage`.

## Local Development Requirements

- Node.js 18+
- An ArcGIS OAuth client ID
- A WebMap item ID to load, or permission to create WebMaps in your ArcGIS org

## Local Setup

### 1. Clone The Repository

```bash
git clone https://github.com/ralouta/ArcGIS-JavaScript-AI-Component.git
cd ArcGIS-JavaScript-AI-Component
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Create Local Config Files

macOS and Linux:

```bash
cp .env.example .env.local
cp mcp-hub.config.example.json mcp-hub.config.json
```

Windows PowerShell:

```powershell
Copy-Item .env.example .env.local
Copy-Item mcp-hub.config.example.json mcp-hub.config.json
```

Windows Command Prompt:

```bat
copy .env.example .env.local
copy mcp-hub.config.example.json mcp-hub.config.json
```

### 4. Configure Environment

Edit `.env.local` in the project root:

```bash
VITE_ARCGIS_OAUTH_APP_ID=your-client-id
VITE_ARCGIS_PORTAL_URL=https://www.arcgis.com
VITE_APP_NAME=ArcGIS Agent Components Demo
```

Update `mcp-hub.config.json` with the MCP servers you want to use and any local-only API keys.

### 5. Configure ArcGIS OAuth

1. Sign in to your ArcGIS portal and create a new credential item:
	- Click `New item`.
	- In the `New item` popup, click `Developer credentials`.
2. Choose the credential type:
	- Select `OAuth 2.0 credential` for user authentication.
	- Click `Next`.
3. Add the local redirect URLs:
	- `http://localhost:5173`
	- `http://localhost:4173`
	- Leave the remaining settings at their defaults.
	- Click `Next`.
4. Fill in the credential metadata in a way that is easy for you or your team to identify later.
	For the workshop, you can use values like:
	- Title: `<your_title>`
	- Tags: `<tag1>`, `<tag2>`, `<tag3>`
	- Summary: `Developer credentials for AI Workshop client app exercise.`
	Then click `Next`.
5. Review the summary page and click `Create`.
6. Copy the generated client ID and add it to `.env.local` as the value of `VITE_ARCGIS_OAUTH_APP_ID`.

Example:

```bash
VITE_ARCGIS_OAUTH_APP_ID=your-generated-client-id
```

## Local Run Commands

```bash
npm run dev
npm run hub
npm run hub:dev
npm run build
npm run preview
npm run test:local
```

Run the app and hub in separate terminals when using MCP features.

Terminal 1: start the Vite app

```bash
cd ArcGIS-JavaScript-AI-Component
npm run dev
```

Terminal 2: open a new terminal window or tab, change into the repo again, then start the MCP hub

```bash
cd ArcGIS-JavaScript-AI-Component
npm run hub
```

If you are editing the hub and want automatic restarts, use this in Terminal 2 instead:

```bash
cd ArcGIS-JavaScript-AI-Component
npm run hub:dev
```

## Local Tests

This workspace includes a local-only test harness in `tests/`.

- The directory is intentionally listed in `.gitignore` so ad hoc validation stays local.
- The tests exercise the extracted pure MCP core logic used by the app, not browser-only ArcGIS component rendering.
- Run them with:

```bash
npm run test:local
```

What the local tests currently cover:

- MCP endpoint normalization and hub server URL resolution
- MCP tool prompt construction
- JSON and fenced-JSON parsing
- geometry hint extraction from structured MCP payloads and plain text
- source-backed geometry derivation for points, extents, and countries

## Using The App

1. Sign in with ArcGIS.
2. Load a WebMap by item ID, or create a new map.
3. Ask map questions, run MCP-backed prompts, or create/manage hosted layers.

Demo WebMap ID:

```text
0cafaf0aa4174e5bac19113ab69bdc85
```

Example prompts:

**Map & navigation**
- `what layers are in this webmap?`
- `navigate me to baalbek`
- `zoom to the extent of the Streets layer`

**Create Feature Layer**
- `create a point layer named Sites with fields: Name:string, Category:string, Status:string`
- `create a polygon layer called Flood Zones with a Description field`
- `make a new polyline layer named Roads with fields: Road_Name:string, Speed_Limit:integer`

**Manage Feature Layer (add / update / delete features)**
- `add a point at the Eiffel Tower to the Sites layer`
- `add a feature to the last created layer at Central Park, New York`
- `delete all features named "Test" from the Sites layer`
- `update the feature named "HQ" in the Sites layer — set Status to Active`

**Add Layer to Map**
- `add the Utrecht Parks layer to the map`
- `load the layer with item id 3e2f1ab4c8d94567890abcdef1234567`
- `add this layer to the map: https://services.arcgis.com/your-org/arcgis/rest/services/MyService/FeatureServer/0`


## MCP Hub

The local hub in `hub/server.ts` aggregates multiple MCP servers behind one endpoint.

You can add servers in two ways from the MCP manager:

- Command-based `stdio` servers such as `npx`, `node`, `python`, or `uvx`
- Direct HTTP MCP server URLs

Example remote bridge via `mcp-remote`:

```text
Command:   npx
Arguments: mcp-remote https://your-remote-mcp-server.com/mcp
```

The hub runs on port `8808` by default and is proxied through Vite at `/api/mcp` during development.

### Connecting the TA5500 RAG (Tel Aviv master plan)

The RAG lives in its own repo (`ta5500-rag`). It exposes an HTTP service, and the `mcp/` folder there is an MCP (stdio) wrapper around it. No change to this app's code is needed: the existing MCP passthrough agent discovers the tools from the hub.

1. In the `ta5500-rag` repo, start the service: `docker compose up -d` (it listens on `http://localhost:8000`). Put `RAG_API_KEY=<your key>` in the `.env` next to its `docker-compose.yml` first, if you want the API protected.
2. In the same repo, run `npm install` inside `mcp/`.
3. Add the server to `mcp-hub.config.json` (see the `ta5500` entry there), or from the MCP manager: Command `node`, Arguments `<path-to>/ta5500-rag/mcp/server.mjs`, environment `RAG_BASE_URL=http://localhost:8000` and `RAG_API_KEY=<same key>`. Set `enabled` to `true`. The entry expects `ta5500-rag` as a sibling of this repo's root folder; its relative path (`../../ta5500-rag/mcp/server.mjs`) resolves from the folder where the hub starts, so start the hub from this repo's app folder (the one containing `package.json`).
4. Reload the app. The hub should list four tools: `search_plan`, `get_plan_contents`, `get_plan_locations`, `get_plan_chunk`.

Tips:
- Ask about the plan explicitly, for example "מה ההוראות בתוכנית תא/5500 לאזור 102א' דרום גלילות?". Questions that only mention a planning area can be routed to the map's data-exploration agent instead.
- Check that it is the MCP agent that answered: the browser's network tab should show `tools/call` requests to `/api/mcp`.
- Known issue: one test question ended with "The MCP Hub server did not return a response". The cause is not known yet.
- `RAG_API_KEY` is read from `.env.local` by `npm run hub` and inherited by the ta5500 server; keep it out of `mcp-hub.config.json`, which is tracked.

## Assistant Notes

- The assistant stays available even on empty maps.
- Map-aware built-in tools wait until the map is ready and assistant data has been prepared.
- Empty maps still support MCP and custom assistant workflows.

## Troubleshooting

| Symptom | Fix |
|---|---|
| Sign-in fails | Check `VITE_ARCGIS_OAUTH_APP_ID` and redirect URLs |
| Map will not load | Verify the WebMap ID and sharing permissions |
| MCP tools are unavailable | Confirm you opened a second terminal, changed into the repo folder, and started `npm run hub` or `npm run hub:dev` |
| Feature layer creation fails | Verify the account can create hosted feature layers |
| Map-aware answers are weak | Refresh assistant data for the current map |

## URL Parameters

The only supported URL parameter is `?mode=edit`.

Use it when you want the wider assistant panel and the theme editor controls:

```text
http://localhost:5173/?mode=edit
```

In edit mode you can customise:

- Header title, subtitle, and font
- Header and chat panel background colors and borders
- Chat panel title and text colors

All changes are saved to `localStorage` and survive page refreshes. Use the **Cancel** button in the theme editor to revert to the values from when you opened the dialog.

## Architecture

The app is structured as a thin React orchestrator (`App.tsx`) wiring together focused hook and component modules:

| Layer | Files |
|---|---|
| Hooks | `useAuth`, `useWebMap`, `useAssistantSetup`, `useTheme` |
| Components | `AppHeader`, `AssistantPanel`, `MapView`, `AccountMenu`, `SignInScreen`, `MapPickerScreen`, `SignOutDialog`, `ChangeMapDialog`, `NewMapDialog`, `ThemeEditorDialog` |
| Agents | `McpPassthroughAgent`, `mcpAgentCore`, `AddLayerToMapAgent`, `CreateFeatureLayerAgent`, `ManageFeatureLayerAgent` |
| Utils | `mcpGeoRenderer`, `arcgisMcp`, `arcgisOnline`, `featureLayerEdits`, `agentHelpers`, `mcpZodSchema`, `assistantStyler` |

### MCP Geo Pipeline

When an MCP tool call returns results, the pipeline:

1. Runs a **single** LLM call (`extractAndSelectGeoEntities`) to extract all geocodable place names from a compact digest of all source records.
2. Matches each place name directly to the source articles/records that mention it.
3. Builds popup context from matched records (specific article title, description, and URL) rather than regex-matching against the raw JSON corpus — so "Tyre" shows the 2 articles about Tyre while "Lebanon" gracefully falls back to prose rather than repeating all 10 articles.

## Copilot Agent Team

The `.github/agents/` directory contains a specialist agent team for VS Code Copilot:

| Agent | When to use |
|---|---|
| `feature-orchestrator` | End-to-end feature delivery (PLAN → BUILD → TEST → SHIP) |
| `arcgis-calcite` | Calcite Design System and ArcGIS 5.0 web components |
| `mcp` | MCP hub, passthrough agent, geo renderer |
| `testing` | Code quality, slot validation, accessibility, JS correctness |
| `docs` | README and inline documentation |
| `github-manager` | Branch naming, commits, PRs |
| `typescript` | Type errors, generics, Zod schemas |
| `react-architect` | Component extraction, hooks, project structure |
| `html` | Semantic HTML, accessibility, slot composition |
| `code-security` | OWASP checks, secret detection, security audits |

