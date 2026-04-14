export const webSearchTool = {
  name: 'web_search',
  description:
    'Search the web for up-to-date information using a keyword query. Returns top results from DuckDuckGo Instant Answer.',
  parameters: [
    { name: 'query', type: 'string', required: true, description: 'Search query string.' }
  ],
  async execute(args, _ctx) {
    const query = typeof args.query === 'string' ? args.query.trim() : '';
    if (!query) {
      return {
        ok: false,
        error: { code: 'INVALID_ARGS', message: 'query is required and must be a non-empty string.' }
      };
    }

    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;

    let raw;
    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': 'FamilyCo/1.0 (+https://familyco.app)' },
        signal: AbortSignal.timeout(10_000)
      });
      if (!response.ok) {
        return {
          ok: false,
          error: { code: 'SEARCH_API_ERROR', message: `DuckDuckGo API returned HTTP ${response.status}.` }
        };
      }
      raw = await response.text();
    } catch (err) {
      return {
        ok: false,
        error: {
          code: 'SEARCH_FETCH_FAILED',
          message: err instanceof Error ? err.message : 'Network error.'
        }
      };
    }

    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      return {
        ok: false,
        error: { code: 'SEARCH_PARSE_ERROR', message: 'Unexpected response format from search API.' }
      };
    }

    const results = [];

    const abstractText = typeof data.AbstractText === 'string' ? data.AbstractText : '';
    const abstractUrl = typeof data.AbstractURL === 'string' ? data.AbstractURL : '';
    const heading = typeof data.Heading === 'string' ? data.Heading : query;

    if (abstractText) {
      results.push({ title: heading, snippet: abstractText, url: abstractUrl });
    }

    const related = Array.isArray(data.RelatedTopics) ? data.RelatedTopics : [];
    for (const topic of related.slice(0, 8)) {
      if (topic && typeof topic === 'object' && !Array.isArray(topic)) {
        if (typeof topic.Text === 'string' && typeof topic.FirstURL === 'string') {
          results.push({
            title: topic.Text.split(' - ')[0] ?? topic.Text,
            snippet: topic.Text,
            url: topic.FirstURL
          });
        }
      }
    }

    return { ok: true, output: { query, results } };
  }
};
