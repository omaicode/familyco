const TAVILY_SEARCH_ENDPOINT = 'https://api.tavily.com/search';
const REQUEST_TIMEOUT_MS = 20000;

function invalidArguments(message) {
  return { ok: false, error: { code: 'INVALID_ARGUMENTS', message } };
}

function missingApiKey() {
  return {
    ok: false,
    error: {
      code: 'MISSING_TAVILY_API_KEY',
      message: 'TAVILY_API_KEY is missing. Configure it in Tools page custom fields or server environment before using Tavily tools.'
    }
  };
}

function resolveTavilyApiKey(args) {
  const configured = typeof args?.customFields?.tavilyApiKey === 'string'
    ? args.customFields.tavilyApiKey.trim()
    : '';

  if (configured) {
    return configured;
  }

  return process.env.TAVILY_API_KEY?.trim() ?? '';
}

function normalizeQuery(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeSearchDepth(value) {
  if (typeof value !== 'string') return 'basic';
  const normalized = value.trim().toLowerCase();
  return normalized === 'advanced' ? 'advanced' : 'basic';
}

function normalizeMaxResults(value, fallback) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.min(10, Math.max(1, Math.floor(value)));
}

function normalizeBoolean(value, fallback) {
  return typeof value === 'boolean' ? value : fallback;
}

function normalizeFocusPoints(value) {
  if (typeof value !== 'string') return [];
  return value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

async function tavilySearch(payload, apiKey) {
  const timeout = new AbortController();
  const timer = setTimeout(() => timeout.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(TAVILY_SEARCH_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ api_key: apiKey, ...payload }),
      signal: timeout.signal
    });

    const raw = await response.text();
    const body = raw ? safeParseJson(raw) : {};

    if (!response.ok) {
      const message = typeof body?.error === 'string' ? body.error : `Tavily request failed with status ${response.status}`;
      throw new Error(message);
    }

    return body;
  } finally {
    clearTimeout(timer);
  }
}

const tavilyCustomFields = {
  tavilyApiKey: {
    name: 'TAVILY_API_KEY',
    type: 'text',
    required: true,
    description: 'API key for authenticating with Tavily API. Get it from your Tavily account dashboard.'
  }
};

function safeParseJson(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return { raw };
  }
}

function normalizeResults(results) {
  if (!Array.isArray(results)) return [];

  return results.map((item) => ({
    title: typeof item?.title === 'string' ? item.title : null,
    url: typeof item?.url === 'string' ? item.url : null,
    content: typeof item?.content === 'string' ? item.content : null,
    score: typeof item?.score === 'number' ? item.score : null,
    publishedDate: typeof item?.published_date === 'string' ? item.published_date : null,
    rawContent: typeof item?.raw_content === 'string' ? item.raw_content : null
  }));
}

function buildResearchMarkdown(input) {
  const findings = input.findings.length > 0
    ? input.findings.map((finding) => `- ${finding}`).join('\n')
    : '- No strong findings returned from source snippets.';

  const sources = input.sources.length > 0
    ? input.sources.map((source) => `- ${source.title || 'Untitled source'}: ${source.url || 'N/A'}`).join('\n')
    : '- No sources returned.';

  return [
    '## Research Topic',
    input.topic,
    '',
    '## Focus Points',
    input.focusPoints.length > 0 ? input.focusPoints.map((point) => `- ${point}`).join('\n') : '- No explicit focus points provided.',
    '',
    '## Executive Summary',
    input.answer || 'No direct answer returned by Tavily. Review findings and sources for detail.',
    '',
    '## Key Findings',
    findings,
    '',
    '## Sources',
    sources,
    '',
    '## Notes',
    '- Verify high-impact claims before operational decisions.',
    '- Escalate for approval before external side effects.'
  ].join('\n');
}

/** @type {import('@familyco/core').PluginToolDefinition[]} */
export const tavilyTools = [
  {
    name: 'tavily_search',
    description: 'Search the web through Tavily API and return ranked sources for a query.',
    parameters: [
      { name: 'query', type: 'string', required: true, description: 'Search query to send to Tavily.' },
      { name: 'searchDepth', type: 'string', required: false, description: 'basic or advanced. Defaults to basic.' },
      { name: 'maxResults', type: 'number', required: false, description: 'Number of results from 1 to 10. Defaults to 5.' },
      { name: 'includeAnswer', type: 'boolean', required: false, description: 'Include Tavily direct answer when available. Defaults to true.' },
      { name: 'includeRawContent', type: 'boolean', required: false, description: 'Include raw content from results when available. Defaults to false.' }
    ],
    customFields: tavilyCustomFields,
    async execute(args) {
      const query = normalizeQuery(args.query);
      if (!query) {
        return invalidArguments('query is required.');
      }

      const apiKey = resolveTavilyApiKey(args);
      if (!apiKey) {
        return missingApiKey();
      }

      const searchDepth = normalizeSearchDepth(args.searchDepth);
      const maxResults = normalizeMaxResults(args.maxResults, 5);
      const includeAnswer = normalizeBoolean(args.includeAnswer, true);
      const includeRawContent = normalizeBoolean(args.includeRawContent, false);

      try {
        const data = await tavilySearch({
          query,
          search_depth: searchDepth,
          max_results: maxResults,
          include_answer: includeAnswer,
          include_raw_content: includeRawContent
        }, apiKey);

        return {
          ok: true,
          output: {
            query,
            searchDepth,
            answer: typeof data?.answer === 'string' ? data.answer : null,
            responseTimeMs: typeof data?.response_time === 'number' ? data.response_time : null,
            results: normalizeResults(data?.results)
          }
        };
      } catch (error) {
        return {
          ok: false,
          error: {
            code: 'TAVILY_SEARCH_FAILED',
            message: error instanceof Error ? error.message : 'Tavily search failed.'
          }
        };
      }
    }
  },
  {
    name: 'tavily_research_brief',
    description: 'Run an advanced Tavily search and produce a compact research brief with findings and sources.',
    parameters: [
      { name: 'topic', type: 'string', required: true, description: 'Main topic to research.' },
      { name: 'focusPoints', type: 'string', required: false, description: 'Comma-separated focus points to emphasize in research.' },
      { name: 'maxResults', type: 'number', required: false, description: 'Number of results from 1 to 10. Defaults to 7.' }
    ],
    customFields: tavilyCustomFields,
    async execute(args) {
      const topic = normalizeQuery(args.topic);
      if (!topic) {
        return invalidArguments('topic is required.');
      }

      const apiKey = resolveTavilyApiKey(args);
      if (!apiKey) {
        return missingApiKey();
      }

      const focusPoints = normalizeFocusPoints(args.focusPoints);
      const maxResults = normalizeMaxResults(args.maxResults, 7);
      const query = focusPoints.length > 0 ? `${topic}. Focus on: ${focusPoints.join('; ')}` : topic;

      try {
        const data = await tavilySearch({
          query,
          search_depth: 'advanced',
          max_results: maxResults,
          include_answer: true,
          include_raw_content: true
        }, apiKey);

        const results = normalizeResults(data?.results);
        const findings = results
          .map((item) => (item.content || item.rawContent || '').replace(/\s+/g, ' ').trim())
          .filter((item) => item.length > 0)
          .slice(0, 5)
          .map((item) => (item.length > 220 ? `${item.slice(0, 217)}...` : item));

        const markdown = buildResearchMarkdown({
          topic,
          focusPoints,
          answer: typeof data?.answer === 'string' ? data.answer : '',
          findings,
          sources: results
        });

        return {
          ok: true,
          output: {
            topic,
            query,
            answer: typeof data?.answer === 'string' ? data.answer : null,
            findings,
            sources: results,
            briefMarkdown: markdown
          }
        };
      } catch (error) {
        return {
          ok: false,
          error: {
            code: 'TAVILY_RESEARCH_FAILED',
            message: error instanceof Error ? error.message : 'Tavily research failed.'
          }
        };
      }
    }
  }
];
