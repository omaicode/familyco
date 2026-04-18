export interface ParsedApiError {
  code: string | null;
  statusCode: number | null;
  message: string;
  rawMessage: string;
}

const API_ERROR_PATTERN = /^([A-Z0-9_]+)(?::(\d{3}))?:(.+)$/;

export const parseApiError = (error: unknown): ParsedApiError => {
  const rawMessage = error instanceof Error ? error.message : 'Unknown error';
  const match = API_ERROR_PATTERN.exec(rawMessage);

  if (!match) {
    return {
      code: null,
      statusCode: null,
      message: rawMessage,
      rawMessage
    };
  }

  const [, code, statusRaw, messageRaw] = match;
  const statusCode = statusRaw ? Number(statusRaw) : null;
  const message = messageRaw.trim();

  return {
    code,
    statusCode: Number.isFinite(statusCode) ? statusCode : null,
    message: message.length > 0 ? message : rawMessage,
    rawMessage
  };
};
