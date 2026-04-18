# Tavily Research

Use this skill when you need credible, up-to-date web research before making planning, staffing, or execution decisions.

## When To Use

- Validate assumptions with external sources.
- Compare tools, vendors, or market practices.
- Build a fast research brief with source links.
- Collect evidence before proposing strategy updates.

## Required Setup

- Tavily API key must be available in server environment: TAVILY_API_KEY.
- If API key is missing, tool execution should fail fast and request setup.

## Available Tools

- plugin.base.tavily_search: targeted web search with ranked sources.
- plugin.base.tavily_research_brief: advanced search plus summarized research brief.

## Standard Workflow

1. Clarify research objective and decision context.
2. Run plugin.base.tavily_search to gather initial source landscape.
3. Run plugin.base.tavily_research_brief with focus points for synthesis.
4. Validate source quality and remove low-confidence claims.
5. Present findings with assumptions, risks, and recommended next action.

## Quality Bar

- Prioritize high-signal sources over volume.
- Keep findings traceable to explicit URLs.
- Separate facts, assumptions, and recommendations.
- Call out stale or conflicting sources.

## Safety Guardrails

- Do not treat unverified claims as facts.
- Request approval before irreversible actions based on external data.
- Respect data privacy and do not expose secrets in search queries.
