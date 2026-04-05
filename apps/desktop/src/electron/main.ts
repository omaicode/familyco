import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { app, BrowserWindow } from 'electron';

import { registerDesktopIpcHandlers } from './ipc/ipc-handlers.js';
import { startEmbeddedServer, type EmbeddedServerRuntime } from './server-bootstrap.js';

const dirname = path.dirname(fileURLToPath(import.meta.url));

const resolveRendererUrl = (): string => {
  return process.env.RENDERER_DEV_URL ?? 'http://127.0.0.1:5173';
};

let mainWindow: BrowserWindow | null = null;
let embeddedServer: EmbeddedServerRuntime | null = null;

interface DesktopRuntimeConfig {
  apiBaseUrl: string;
  apiKey: string;
}

const createMainWindow = async (runtimeConfig: DesktopRuntimeConfig): Promise<void> => {
  const preloadPath = path.join(dirname, 'preload.cjs');

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1120,
    minHeight: 720,
    title: 'FamilyCo',
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      additionalArguments: [
        `--familyco-api-base-url=${runtimeConfig.apiBaseUrl}`,
        `--familyco-api-key=${runtimeConfig.apiKey}`
      ]
    }
  });

  await mainWindow.loadURL(resolveRendererUrl());
};

const startDesktop = async (): Promise<void> => {
  const apiKey = process.env.FAMILYCO_API_KEY ?? 'local-dev-api-key';

  embeddedServer = await startEmbeddedServer({
    port: Number(process.env.DESKTOP_SERVER_PORT ?? 3040),
    host: process.env.DESKTOP_SERVER_HOST ?? '127.0.0.1'
  });

  registerDesktopIpcHandlers({
    apiBaseUrl: embeddedServer.baseUrl,
    apiKey
  });

  await createMainWindow({
    apiBaseUrl: embeddedServer.baseUrl,
    apiKey
  });
};

app.whenReady().then(startDesktop).catch((error) => {
  console.error(error);
  app.quit();
});

app.on('window-all-closed', async () => {
  if (embeddedServer) {
    await embeddedServer.close();
  }

  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', async () => {
  if (BrowserWindow.getAllWindows().length === 0 && embeddedServer) {
    await createMainWindow({
      apiBaseUrl: embeddedServer.baseUrl,
      apiKey: process.env.FAMILYCO_API_KEY ?? 'local-dev-api-key'
    });
  }
});
