# PilotCRM

An AI-powered CRM dashboard where a sales copilot lives inside the app — it sees the full pipeline, takes actions, and renders rich UI directly in the chat. Built with CopilotKit to demonstrate shared state, generative UI, human-in-the-loop, and real-time tool execution.

**Live:** [pilot-crm.onrender.com](https://pilot-crm.onrender.com)

---

## What I Built

A working sales CRM where the AI copilot is a first-class participant, not just a chatbot bolted on.

### CopilotKit Integration (the core)

| Feature | Implementation |
|---|---|
| **Shared State** | `useCopilotReadable` exposes accounts, pipeline stats, call records, and activities to the LLM in real time |
| **Tool Execution** | 6 `useCopilotAction` hooks: move deals, add notes, update likelihood, flag risks, get account briefs, create visualizations |
| **Generative UI** | The `createVisualization` action renders 5 chart types (funnel, bar, comparison, scorecard, progress) — the LLM picks the type and computes data points from live CRM state |
| **Human-in-the-Loop** | `moveAccountToStage` requires explicit user approval for `closed_won` deals before executing |
| **Self-Hosted Runtime** | `/api/copilotkit` endpoint with `AnthropicAdapter` — gives full control over the model (Claude Sonnet) and prompt behavior |

### Beyond CopilotKit

- **AI Voice Calls** — Vapi-powered browser calls where the AI plays the sales rep with full account context injected via `assistantOverrides`
- **Post-Call Intelligence** — Claude analyzes transcripts server-side, then automatically updates the pipeline card (likelihood, stage, tags, notes, follow-up dates)
- **Inbound Lead Capture** — Vapi webhook extracts structured lead data from inbound phone calls and creates new CRM accounts
- **Persistent Store** — JSON file-backed server store that survives across sessions within a deployment

---

## Architecture

```
src/
├── app/
│   ├── page.tsx              # Main orchestrator: state, CopilotKit hooks, routing
│   ├── providers.tsx         # CopilotKit provider + sidebar config
│   ├── layout.tsx            # Root layout with Inter font
│   └── api/
│       ├── copilotkit/       # Self-hosted CopilotKit runtime (Anthropic adapter)
│       ├── crm/              # Unified data API — all reads and mutations
│       ├── analyze-sentiment/ # Claude-powered call transcript analysis
│       └── vapi/             # Webhook for inbound voice call processing
├── components/
│   ├── DashboardView.tsx     # Pipeline kanban, stats cards, activity feed
│   ├── AccountsView.tsx      # Sortable account table
│   ├── CallsView.tsx         # Call history with expandable transcripts
│   ├── CalendarView.tsx      # Monthly calendar with follow-ups and calls
│   ├── CallModal.tsx         # 3-state voice call UI (pre-call → active → post-call)
│   └── AppSidebar.tsx        # Navigation sidebar
└── lib/
    ├── data.ts               # Type definitions + seed data (immutable)
    └── store.ts              # Server-side mutable store with file persistence
```

**Key design decision:** All CRM state lives server-side in `store.ts`, exposed through a single `/api/crm` endpoint. The client fetches on mount and after every mutation. CopilotKit actions, voice calls, and inbound webhooks all funnel through the same API — single source of truth.

---

## Setup

```bash
git clone https://github.com/cememirsenyurt/pilot-crm.git
cd pilot-crm
npm install
```

Create a `.env` file:

```env
# Required — powers the CopilotKit sidebar and sentiment analysis
ANTHROPIC_API_KEY=your_anthropic_key

# Optional — enables AI voice calls
NEXT_PUBLIC_VAPI_PUBLIC_KEY=your_vapi_public_key
NEXT_PUBLIC_VAPI_ASSISTANT_ID=your_vapi_assistant_id
VAPI_API_KEY=your_vapi_api_key
```

Run:

```bash
npm run dev
```

Open [localhost:3000](http://localhost:3000). The CopilotKit sidebar opens by default — try asking it about your pipeline.

---

## What I'd Improve With More Time

- **AG-UI Protocol integration** — connect a LangGraph agent via AG-UI instead of direct `useCopilotAction` hooks, enabling multi-step reasoning and tool chaining
- **Real database** — replace the JSON file store with Postgres/Prisma for proper persistence and concurrent access
- **Drag-and-drop pipeline** — make the kanban board interactive with `dnd-kit`, with CopilotKit observing drag events
- **Thread persistence** — use CopilotKit Cloud's thread storage so conversations survive page refreshes
- **Testing** — add integration tests for CopilotKit actions and the CRM API
- **Mobile responsive** — current layout is desktop-only

## AI Tools Used

This project was built with **Cursor** (AI coding assistant). I used it for:
- Scaffolding the Next.js project and component structure
- Implementing CopilotKit hooks based on their SDK documentation
- Writing the Vapi integration and webhook handlers
- Debugging the Anthropic `tool_use`/`tool_result` pairing issue with CopilotKit's `renderAndWait`
- Post-call analysis prompt engineering

All architectural decisions (self-hosted runtime over Cloud, single API endpoint pattern, server-side store, the `handler`+`render` pattern over `renderAndWait`) were made deliberately based on researching CopilotKit's docs and examples.

---

## Tech Stack

- **Next.js 15** — App Router, API routes, standalone output
- **TypeScript** — end-to-end type safety
- **Tailwind CSS 4** — utility-first styling
- **CopilotKit** — `@copilotkit/react-core`, `@copilotkit/react-ui`, `@copilotkit/runtime`
- **Anthropic Claude** — LLM for copilot sidebar + server-side analysis
- **Vapi** — browser-based AI voice calls + inbound webhook
- **Lucide React** — icon library
