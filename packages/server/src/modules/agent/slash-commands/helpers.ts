export function buildUsageReply(usage: string, helpText: string): string {
  return `${usage}\n\n${helpText}`;
}

export function summarizeSlashDescription(description: string, fallback: string): string {
  const normalized = description.replace(/\s+/g, ' ').trim();
  if (normalized.length === 0) {
    return fallback;
  }

  if (normalized.length <= 72) {
    return normalized;
  }

  return `${normalized.slice(0, 69).trimEnd()}...`;
}
