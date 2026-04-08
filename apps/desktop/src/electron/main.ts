import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { app, BrowserWindow, dialog } from 'electron';
import {
  broadcastDesktopUpdateEvent,
  registerDesktopIpcHandlers
} from './ipc/ipc-handlers.js';
import type { EmbeddedServerRuntime } from './server-bootstrap.js';
import { startDesktopUpdater, type DesktopUpdaterRuntime } from './updater.js';

const dirname = path.dirname(fileURLToPath(import.meta.url));

const resolveRendererTarget = (): { mode: 'url'; value: string } | { mode: 'file'; value: string } => {
  const rendererDevUrl = process.env.RENDERER_DEV_URL;
  if (rendererDevUrl) {
    return { mode: 'url', value: rendererDevUrl };
  }

  if (!app.isPackaged) {
    return { mode: 'url', value: 'http://127.0.0.1:5173' };
  }

  const rendererDistOverride = process.env.RENDERER_DIST_PATH;
  if (rendererDistOverride) {
    return { mode: 'file', value: path.join(rendererDistOverride, 'index.html') };
  }

  const defaultDist = path.join(process.resourcesPath, 'renderer', 'index.html');

  return { mode: 'file', value: defaultDist };
};

let mainWindow: BrowserWindow | null = null;
let embeddedServer: EmbeddedServerRuntime | null = null;
let updaterRuntime: DesktopUpdaterRuntime | null = null;
let isQuitRequested = false;
let isShuttingDown = false;

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

  const rendererTarget = resolveRendererTarget();
  if (rendererTarget.mode === 'url') {
    await mainWindow.loadURL(rendererTarget.value);
  } else {
    await mainWindow.loadFile(rendererTarget.value);
  }

  mainWindow.on('close', (event) => {
    if (isQuitRequested) {
      return;
    }

    event.preventDefault();

    const selection = dialog.showMessageBoxSync(mainWindow!, {
      type: 'question',
      title: 'Close FamilyCo',
      message: 'Bạn muốn đóng ứng dụng như thế nào?',
      detail: 'Thoát hoàn toàn sẽ dừng toàn bộ service chạy ngầm. Đóng giao diện sẽ giữ service chạy nền.',
      buttons: ['Thoát hoàn toàn', 'Chỉ đóng giao diện'],
      defaultId: 1,
      cancelId: 1,
      noLink: true
    });

    if (selection === 0) {
      isQuitRequested = true;
      app.quit();
      return;
    }

    mainWindow?.hide();
  });
};


const shutdownBackgroundServices = async (): Promise<void> => {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;

  if (embeddedServer) {
    await embeddedServer.close();
    embeddedServer = null;
  }
};

const startDesktop = async (): Promise<void> => {
  if (!app.requestSingleInstanceLock()) {
    app.quit();
    return;
  }

  app.on('second-instance', async () => {
    if (mainWindow) {
      if (!mainWindow.isVisible()) {
        mainWindow.show();
      }
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }
      mainWindow.focus();
      return;
    }

    if (embeddedServer) {
      await createMainWindow({
        apiBaseUrl: embeddedServer.baseUrl,
        apiKey: process.env.FAMILYCO_API_KEY ?? 'local-dev-api-key'
      });
    }
  });

  const apiKey = process.env.FAMILYCO_API_KEY ?? 'local-dev-api-key';

  // Store SQLite database in the OS user-data folder for this app.
  // Mac:     ~/Library/Application Support/FamilyCo/familyco.db
  // Windows: C:\Users\<user>\AppData\Roaming\FamilyCo\familyco.db
  // Linux:   ~/.config/FamilyCo/familyco.db
  const dbPath = path.join(app.getPath('userData'), 'familyco.db');

  // Set DATABASE_URL before importing @familyco/server so the Prisma singleton
  // is initialised with the correct path.
  process.env.DATABASE_URL = `file://${dbPath}`;

  // Dynamic import ensures server-bootstrap (and transitively @familyco/server /
  // prisma-client) is not loaded until DATABASE_URL is set above.
  const { startEmbeddedServer } = await import('./server-bootstrap.js');

  process.env.FAMILYCO_QUEUE_DRIVER = 'memory';
  process.env.ENABLE_QUEUE_WORKERS = '0';

  embeddedServer = await startEmbeddedServer({
    port: Number(process.env.DESKTOP_SERVER_PORT ?? 0),
    host: process.env.DESKTOP_SERVER_HOST ?? '127.0.0.1'
  });

  updaterRuntime = startDesktopUpdater({
    emit: (payload) => {
      broadcastDesktopUpdateEvent(payload);
    }
  });

  registerDesktopIpcHandlers({
    apiBaseUrl: embeddedServer.baseUrl,
    apiKey,
    checkForUpdates: async () => {
      return updaterRuntime ? updaterRuntime.checkForUpdates() : false;
    },
    installDownloadedUpdate: async () => {
      return updaterRuntime ? updaterRuntime.installDownloadedUpdate() : false;
    }
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
  if (isQuitRequested) {
    await shutdownBackgroundServices();
    app.quit();
  }
});

app.on('before-quit', async () => {
  isQuitRequested = true;
  await shutdownBackgroundServices();
});

app.on('activate', async () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (!mainWindow.isVisible()) {
      mainWindow.show();
    }
    mainWindow.focus();
    return;
  }

  if (BrowserWindow.getAllWindows().length === 0 && embeddedServer) {
    await createMainWindow({
      apiBaseUrl: embeddedServer.baseUrl,
      apiKey: process.env.FAMILYCO_API_KEY ?? 'local-dev-api-key'
    });
  }
});
