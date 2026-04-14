# Web Researcher

Adds web search and URL fetch capabilities to agents, enabling them to research topics and retrieve live information from the web.

## Structure

```
web-researcher/
├── src/
│   ├── tools/
│   │   ├── web-search.ts   — DuckDuckGo Instant Answer search tool
│   │   └── web-fetch.ts    — HTTP fetch + HTML stripping tool
│   ├── skills/
│   │   └── web-research.md — Research guidelines injected into agent prompts
│   └── index.ts            — Plugin entry: metadata, tools, skills
├── package.json
└── README.md
```

## Capabilities

| Kind | Name | Description |
|------|------|-------------|
| `tool` | `web_search` | Search the web via DuckDuckGo Instant Answer API |
| `tool` | `web_fetch` | Fetch and extract readable text from a URL |
| `skill` | `web-research` | Research guidelines injected into agent system prompt |

## Tool names (namespaced)

When enabled, agents can call:

- `plugin.web-researcher.web_search` — keyword search, returns top results with title, snippet, and URL
- `plugin.web-researcher.web_fetch` — fetches a URL, strips HTML, returns clean text (max 12 000 chars)

## Configuration

- **Default approval mode**: `require_review` — every outbound web request is reviewed before execution.
- Change to `auto` in the Plugins settings page if you trust the agent to search autonomously.

## Notes

- All outbound requests are logged in the Audit trail.
- The plugin respects the global `ApprovalGuard` policy.
- No API key required — uses the DuckDuckGo public Instant Answer API.
