import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

import { app, BrowserWindow, dialog, Menu, Tray, nativeImage } from 'electron';
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

const resolveWindowIconPath = (): string | undefined => {
  const candidates = [
    // Typical dev run from repo root
    path.resolve(process.cwd(), 'apps/electron/icons/png/256x256.png'),
    // Typical dev run from apps/electron
    path.resolve(process.cwd(), 'icons/png/256x256.png'),
    // Compiled main.js in dist/electron
    path.resolve(dirname, '../../icons/png/256x256.png'),
    // Optional packaged resource copy
    path.join(process.resourcesPath, 'icons/png/256x256.png')
  ];

  for (const iconPath of candidates) {
    if (existsSync(iconPath)) {
      return iconPath;
    }
  }

  return undefined;
};

const resolveWindowIcon = async (): Promise<Electron.NativeImage | undefined> => {
  const iconPath = resolveWindowIconPath();
  if (iconPath) {
    const icon = nativeImage.createFromPath(iconPath);
    if (!icon.isEmpty()) {
      return icon;
    }
  }

  try {
    const fallback = await app.getFileIcon(process.execPath, { size: 'normal' });
    if (!fallback.isEmpty()) {
      return fallback;
    }
  } catch {
    // Ignore fallback errors and return undefined.
  }

  return undefined;
};

let mainWindow: BrowserWindow | null = null;
let embeddedServer: EmbeddedServerRuntime | null = null;
let updaterRuntime: DesktopUpdaterRuntime | null = null;
let tray: Tray | null = null;
let isQuitRequested = false;
let isShuttingDown = false;

interface DesktopRuntimeConfig {
  apiBaseUrl: string;
  apiKey: string;
}

const showMainWindow = (): void => {
  if (!mainWindow) {
    return;
  }

  if (!mainWindow.isVisible()) {
    mainWindow.show();
  }

  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }

  mainWindow.focus();
};

const resolveTrayIcon = async (): Promise<Electron.NativeImage> => {
  try {
    const icon = await app.getFileIcon(process.execPath, { size: 'small' });
    if (!icon.isEmpty()) {
      return icon;
    }
  } catch {
    // Fallback below when OS cannot resolve executable icon.
  }

  return nativeImage.createEmpty();
};

const ensureTray = async (): Promise<void> => {
  if (tray) {
    return;
  }

  const icon = await resolveTrayIcon();
  tray = new Tray(icon);
  tray.setToolTip('FamilyCo');

  tray.on('click', () => {
    showMainWindow();
  });

  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: 'Open',
        click: () => {
          showMainWindow();
        }
      },
      { type: 'separator' },
      {
        label: 'Exit',
        click: () => {
          isQuitRequested = true;
          app.quit();
        }
      }
    ])
  );
};

const createMainWindow = async (runtimeConfig: DesktopRuntimeConfig): Promise<void> => {
  const preloadPath = path.join(dirname, 'preload.cjs');
  const windowIconPath = resolveWindowIconPath();
  
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1120,
    minHeight: 720,
    title: 'FamilyCo',
    icon: windowIconPath,
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

  if (windowIconPath) {
    const linuxIcon = nativeImage.createFromPath(windowIconPath);
    if (!linuxIcon.isEmpty()) {
      mainWindow.setIcon(linuxIcon);
    }
  }

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
      message: 'Are you sure you want to quit?',
      detail: 'Exiting completely will stop all background services. Minimizing to tray will keep the services running in the background.',
      buttons: ['Exit', 'Minimize to Tray'],
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
    void ensureTray();
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
      showMainWindow();
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
  tray?.destroy();
  tray = null;
  await shutdownBackgroundServices();
});

app.on('activate', async () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    showMainWindow();
    return;
  }

  if (BrowserWindow.getAllWindows().length === 0 && embeddedServer) {
    await createMainWindow({
      apiBaseUrl: embeddedServer.baseUrl,
      apiKey: process.env.FAMILYCO_API_KEY ?? 'local-dev-api-key'
    });
  }
});
