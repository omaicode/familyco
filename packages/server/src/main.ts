import { createApp } from './app.js';

const port = Number(process.env.PORT ?? 4000);
const host = process.env.HOST ?? '0.0.0.0';

const app = createApp();

app
  .listen({ host, port })
  .catch((error: unknown) => {
    app.log.error(error);
    process.exit(1);
  });
