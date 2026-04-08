import { startEmbeddedServer } from './server-bootstrap.js';

const SMOKE_API_KEY = process.env.DESKTOP_SMOKE_API_KEY ?? 'local-dev-api-key';

const requestJson = async <TPayload>(url: string): Promise<TPayload> => {
  const response = await fetch(url, {
    headers: {
      'x-api-key': SMOKE_API_KEY
    }
  });

  if (!response.ok) {
    throw new Error(`DESKTOP_SMOKE_FAILED:${response.status}:${url}`);
  }

  return (await response.json()) as TPayload;
};

const run = async (): Promise<void> => {
  const runtime = await startEmbeddedServer({
    host: '127.0.0.1',
    port: Number(process.env.DESKTOP_SMOKE_PORT ?? 4100),
    authApiKey: SMOKE_API_KEY
  });

  try {
    const payload = await requestJson<{ status?: string }>(`${runtime.baseUrl}/health`);
    if (payload.status !== 'ok') {
      throw new Error('DESKTOP_SMOKE_FAILED:invalid-health-payload');
    }

    const agents = await requestJson<Array<{ id: string }>>(`${runtime.baseUrl}/api/v1/agents`);
    if (!Array.isArray(agents)) {
      throw new Error('DESKTOP_SMOKE_FAILED:invalid-agents-payload');
    }

    const dashboardSummary = await requestJson<{ metrics?: Record<string, number> }>(
      `${runtime.baseUrl}/api/v1/dashboard/summary`
    );

    if (!dashboardSummary.metrics) {
      throw new Error('DESKTOP_SMOKE_FAILED:invalid-dashboard-summary-payload');
    }

    console.log('Desktop smoke passed: health + api routes are ready');
  } finally {
    await runtime.close();
  }
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
