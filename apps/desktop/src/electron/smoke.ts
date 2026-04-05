import { startEmbeddedServer } from './server-bootstrap.js';

const run = async (): Promise<void> => {
  const runtime = await startEmbeddedServer({
    host: '127.0.0.1',
    port: Number(process.env.DESKTOP_SMOKE_PORT ?? 4100)
  });

  try {
    const response = await fetch(`${runtime.baseUrl}/health`);
    if (!response.ok) {
      throw new Error(`DESKTOP_SMOKE_FAILED:${response.status}`);
    }

    const payload = (await response.json()) as { status?: string };
    if (payload.status !== 'ok') {
      throw new Error('DESKTOP_SMOKE_FAILED:invalid-health-payload');
    }

    console.log('Desktop smoke passed');
  } finally {
    await runtime.close();
  }
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
