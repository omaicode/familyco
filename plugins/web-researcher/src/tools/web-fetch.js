export const webFetchTool = {
  name: 'web_fetch',
  description:
    'Fetch and extract readable plain-text content from a given URL. Strips HTML tags and returns cleaned body text (max 12 000 characters).',
  parameters: [
    {
      name: 'url',
      type: 'string',
      required: true,
      description: 'Full URL to fetch (must start with http:// or https://).'
    }
  ],
  async execute(args, _ctx) {
    const url = typeof args.url === 'string' ? args.url.trim() : '';
    if (!url) {
      return {
        ok: false,
        error: { code: 'INVALID_ARGS', message: 'url is required and must be a non-empty string.' }
      };
    }
    if (!/^https?:\/\//i.test(url)) {
      return {
        ok: false,
        error: { code: 'INVALID_URL', message: 'url must start with http:// or https://.' }
      };
    }

    let response;
    try {
      response = await fetch(url, {
        headers: { 'User-Agent': 'FamilyCo/1.0 (+https://familyco.app)' },
        signal: AbortSignal.timeout(15_000)
      });
    } catch (err) {
      return {
        ok: false,
        error: {
          code: 'FETCH_FAILED',
          message: err instanceof Error ? err.message : 'Network error.'
        }
      };
    }

    if (!response.ok) {
      return {
        ok: false,
        error: { code: 'HTTP_ERROR', message: `HTTP ${response.status}: ${response.statusText}` }
      };
    }

    const contentType = response.headers.get('content-type') ?? '';
    const raw = await response.text();

    let content;
    if (contentType.includes('text/html')) {
      content = raw
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&quot;/gi, '"')
        .replace(/\s{2,}/g, ' ')
        .trim()
        .slice(0, 12_000);
    } else {
      content = raw.slice(0, 12_000);
    }

    return { ok: true, output: { url, content, contentType } };
  }
};
