export function readProviderError(providerName: string, payload: unknown): string {
  if (isAdapterRecord(payload)) {
    if (isAdapterRecord(payload.error)) {
      const nestedMessage = asAdapterString(payload.error.message);
      if (nestedMessage) return `PROVIDER_REQUEST_FAILED:${providerName}:${nestedMessage}`;
    }

    const message = asAdapterString(payload.message);
    if (message) return `PROVIDER_REQUEST_FAILED:${providerName}:${message}`;
  }

  return `PROVIDER_REQUEST_FAILED:${providerName}:Unknown provider error`;
}

export function toAdapterErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

export async function readSseStream(
  response: Response,
  onData: (data: string) => void
): Promise<void> {
  if (!response.body) {
    throw new Error('PROVIDER_INVALID_RESPONSE:Missing stream body');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    buffer = consumeSseBuffer(buffer, onData);
  }

  const tail = decoder.decode();
  if (tail.length > 0) {
    buffer += tail;
  }
  consumeSseBuffer(buffer, onData, true);
}

export async function readJsonLikePayload(response: Response): Promise<unknown> {
  const text = await response.text();
  if (text.trim().length === 0) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

export function isAdapterRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function asAdapterString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}

function consumeSseBuffer(
  source: string,
  onData: (data: string) => void,
  flushRemainder = false
): string {
  const normalized = source.replace(/\r\n/g, '\n');
  const events = normalized.split('\n\n');
  const remainder = events.pop() ?? '';

  for (const event of events) {
    publishSseEvent(event, onData);
  }

  if (flushRemainder && remainder.trim().length > 0) {
    publishSseEvent(remainder, onData);
    return '';
  }

  return remainder;
}

function publishSseEvent(event: string, onData: (data: string) => void): void {
  const dataLines = event
    .split('\n')
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trimStart());

  if (dataLines.length === 0) {
    return;
  }

  onData(dataLines.join('\n'));
}
