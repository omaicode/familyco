export interface DailyQuotaGuardOptions {
  maxPerDay: number;
}

export class DailyQuotaGuard {
  private readonly usage = new Map<string, number>();

  constructor(private readonly options: DailyQuotaGuardOptions) {}

  consume(actorId: string): void {
    const today = this.dayKey();
    const key = `${actorId}:${today}`;
    const current = this.usage.get(key) ?? 0;

    if (current >= this.options.maxPerDay) {
      const error = new Error(`QUOTA_EXCEEDED:Daily quota exceeded for ${actorId}`) as Error & {
        statusCode?: number;
      };
      error.statusCode = 429;
      throw error;
    }

    this.usage.set(key, current + 1);
    this.evictStaleKeys(today);
  }

  private dayKey(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private evictStaleKeys(today: string): void {
    for (const key of this.usage.keys()) {
      if (!key.endsWith(`:${today}`)) {
        this.usage.delete(key);
      }
    }
  }
}
