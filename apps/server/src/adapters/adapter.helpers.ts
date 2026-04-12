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
