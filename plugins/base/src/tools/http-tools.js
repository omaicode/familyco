const DEFAULT_TIMEOUT_MS = 15000;
const MAX_TIMEOUT_MS = 60000;

function invalidArguments(message) {
  return { ok: false, error: { code: 'INVALID_ARGUMENTS', message } };
}

function normalizeMethod(value) {
  if (typeof value !== 'string') {
    return 'GET';
  }

  const normalized = value.trim().toUpperCase();
  if (['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(normalized)) {
    return normalized;
  }

  return '';
}

function normalizeUrl(value) {
  if (typeof value !== 'string') {
    return '';
  }

  const raw = value.trim();
  if (!raw) {
    return '';
  }

  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return '';
    }
    return parsed.toString();
  } catch {
    return '';
  }
}

function normalizeTimeoutMs(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return DEFAULT_TIMEOUT_MS;
  }

  const rounded = Math.floor(value);
  return Math.max(1000, Math.min(MAX_TIMEOUT_MS, rounded));
}

function normalizeHeaders(rawHeaders) {
  if (typeof rawHeaders !== 'string' || !rawHeaders.trim()) {
    return {};
  }

  try {
    const parsed = JSON.parse(rawHeaders);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return null;
    }

    const entries = Object.entries(parsed);
    const normalized = {};
    for (const [key, value] of entries) {
      if (typeof value !== 'string') {
        return null;
      }
      normalized[key] = value;
    }
    return normalized;
  } catch {
    return null;
  }
}

function parseResponseBody(contentType, rawBody) {
  if (!rawBody) {
    return null;
  }

  if (typeof contentType === 'string' && contentType.toLowerCase().includes('application/json')) {
    try {
      return JSON.parse(rawBody);
    } catch {
      return rawBody;
    }
  }

  return rawBody;
}

/** @type {import('@familyco/core').PluginToolDefinition[]} */
export const httpTools = [
  {
    name: 'http_request',
    description: 'Send HTTP requests to URLs (GET/POST/PUT/PATCH/DELETE) and return status, headers, and body.',
    parameters: [
      { name: 'url', type: 'string', required: true, description: 'Target URL. Only http/https is allowed.' },
      { name: 'method', type: 'string', required: false, description: 'HTTP method. Defaults to GET.' },
      { name: 'headersJson', type: 'string', required: false, description: 'Optional JSON object string for request headers.' },
      { name: 'body', type: 'string', required: false, description: 'Request body as text. Use for POST/PUT/PATCH.' },
      { name: 'timeoutMs', type: 'number', required: false, description: 'Request timeout in milliseconds (1000-60000).' }
    ],
    enabledByDefault: true,
    async execute(args) {
      const url = normalizeUrl(args.url);
      if (!url) {
        return invalidArguments('url is required and must be a valid http/https URL.');
      }

      const method = normalizeMethod(args.method);
      if (!method) {
        return invalidArguments('method must be one of GET, POST, PUT, PATCH, DELETE.');
      }

      const headers = normalizeHeaders(args.headersJson);
      if (headers === null) {
        return invalidArguments('headersJson must be a valid JSON object string with string values.');
      }

      const timeoutMs = normalizeTimeoutMs(args.timeoutMs);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetch(url, {
          method,
          headers,
          ...(typeof args.body === 'string' ? { body: args.body } : {}),
          signal: controller.signal
        });

        const bodyText = await response.text();
        const contentType = response.headers.get('content-type');
        const body = parseResponseBody(contentType, bodyText);

        return {
          ok: true,
          output: {
            request: {
              url,
              method,
              timeoutMs
            },
            response: {
              status: response.status,
              ok: response.ok,
              headers: Object.fromEntries(response.headers.entries()),
              body
            }
          }
        };
      } catch (error) {
        const code = error instanceof Error && error.name === 'AbortError'
          ? 'HTTP_REQUEST_TIMEOUT'
          : 'HTTP_REQUEST_FAILED';
        return {
          ok: false,
          error: {
            code,
            message: error instanceof Error ? error.message : 'HTTP request failed.'
          }
        };
      } finally {
        clearTimeout(timer);
      }
    }
  }
];
