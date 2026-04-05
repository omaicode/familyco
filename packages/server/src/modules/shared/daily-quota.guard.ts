export interface DailyQuotaGuardOptions {
  maxPerDay: number;
}

export class DailyQuotaGuard {
  private readonly usage = new Map<string, number>();

  constructor(private readonly options: DailyQuotaGuardOptions) {}

  consume(actorId: string): void {
    const key = `${actorId}:${this.dayKey()}`;
    const current = this.usage.get(key) ?? 0;

    if (current >= this.options.maxPerDay) {
      const error = new Error(`QUOTA_EXCEEDED:Daily quota exceeded for ${actorId}`) as Error & {
        statusCode?: number;
      };
      error.statusCode = 429;
      throw error;
    }

    this.usage.set(key, current + 1);
  }

  private dayKey(): string {
    return new Date().toISOString().slice(0, 10);
  }
}
