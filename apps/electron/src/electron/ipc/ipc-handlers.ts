import { BrowserWindow, Notification, dialog, ipcMain } from 'electron';

import type {
  DesktopInvokeRequestMap,
  DesktopInvokeResponseMap,
  DesktopSystemEventPayload,
  DesktopUpdateEventPayload
} from './ipc.types.js';

export interface IpcHandlerOptions {
  apiBaseUrl: string;
  apiKey?: string;
  checkForUpdates?: () => Promise<boolean>;
  installDownloadedUpdate?: () => Promise<boolean>;
}

const withHeaders = (apiKey?: string): HeadersInit => {
  if (!apiKey) {
    return {
      'Content-Type': 'application/json'
    };
  }

  return {
    'Content-Type': 'application/json',
    'x-api-key': apiKey
  };
};

export const registerDesktopIpcHandlers = (options: IpcHandlerOptions): void => {
  const requestJson = async <TResponse>(path: string): Promise<TResponse> => {
    const response = await fetch(`${options.apiBaseUrl}${path}`, {
      method: 'GET',
      headers: withHeaders(options.apiKey)
    });

    if (!response.ok) {
      throw new Error(`IPC_REQUEST_FAILED:${response.status}`);
    }

    return (await response.json()) as TResponse;
  };

  ipcMain.handle(
    'desktop:health',
    async (_event, payload: DesktopInvokeRequestMap['desktop:health']) => {
      const path = payload.path ?? '/health';
      return requestJson<DesktopInvokeResponseMap['desktop:health']>(path);
    }
  );

  ipcMain.handle(
    'desktop:audit:list',
    async (_event, payload: DesktopInvokeRequestMap['desktop:audit:list']) => {
      const limit = payload.limit ?? 20;
      return requestJson<DesktopInvokeResponseMap['desktop:audit:list']>(`/api/v1/audit?limit=${limit}`);
    }
  );

  ipcMain.handle('desktop:agents:list', async () => {
    return requestJson<DesktopInvokeResponseMap['desktop:agents:list']>('/api/v1/agents');
  });

  ipcMain.handle('desktop:update:check', async () => {
    if (!options.checkForUpdates) {
      return { accepted: false } satisfies DesktopInvokeResponseMap['desktop:update:check'];
    }

    const accepted = await options.checkForUpdates();
    return { accepted } satisfies DesktopInvokeResponseMap['desktop:update:check'];
  });

  ipcMain.handle('desktop:update:install', async () => {
    if (!options.installDownloadedUpdate) {
      return { accepted: false } satisfies DesktopInvokeResponseMap['desktop:update:install'];
    }

    const accepted = await options.installDownloadedUpdate();
    return { accepted } satisfies DesktopInvokeResponseMap['desktop:update:install'];
  });

  ipcMain.handle('desktop:notification:show', async (event, payload: DesktopInvokeRequestMap['desktop:notification:show']) => {
    if (!Notification.isSupported()) {
      return { accepted: false } satisfies DesktopInvokeResponseMap['desktop:notification:show'];
    }

    const ownerWindow = BrowserWindow.fromWebContents(event.sender);
    const route = typeof payload.route === 'string' && payload.route.trim().startsWith('/')
      ? payload.route.trim()
      : '/inbox';

    const notification = new Notification({
      title: payload.title,
      body: payload.body,
      urgency: 'normal'
    });

    notification.on('click', () => {
      const win = ownerWindow && !ownerWindow.isDestroyed()
        ? ownerWindow
        : BrowserWindow.getAllWindows()[0];

      if (win && !win.isDestroyed()) {
        if (!win.isVisible()) {
          win.show();
        }

        if (win.isMinimized()) {
          win.restore();
        }

        win.focus();
      }

      broadcastDesktopSystemEvent({
        type: 'notification-click',
        route,
        ...(typeof payload.notificationId === 'string' && payload.notificationId.length > 0
          ? { notificationId: payload.notificationId }
          : {})
      });
    });

    notification.show();
    return { accepted: true } satisfies DesktopInvokeResponseMap['desktop:notification:show'];
  });

  ipcMain.handle('desktop:dialog:open-directory', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender) ?? undefined;
    const result = await dialog.showOpenDialog(win!, {
      properties: ['openDirectory', 'createDirectory'],
      title: 'Select workspace folder'
    });
    return {
      canceled: result.canceled,
      filePaths: result.filePaths
    } satisfies DesktopInvokeResponseMap['desktop:dialog:open-directory'];
  });

  ipcMain.handle('desktop:window:minimize', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win || win.isDestroyed()) {
      return { accepted: false } satisfies DesktopInvokeResponseMap['desktop:window:minimize'];
    }

    win.minimize();
    return { accepted: true } satisfies DesktopInvokeResponseMap['desktop:window:minimize'];
  });

  ipcMain.handle('desktop:window:toggle-maximize', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win || win.isDestroyed()) {
      return {
        accepted: false,
        isMaximized: false
      } satisfies DesktopInvokeResponseMap['desktop:window:toggle-maximize'];
    }

    if (win.isMaximized()) {
      win.unmaximize();
    } else {
      win.maximize();
    }

    return {
      accepted: true,
      isMaximized: win.isMaximized()
    } satisfies DesktopInvokeResponseMap['desktop:window:toggle-maximize'];
  });

  ipcMain.handle('desktop:window:close', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win || win.isDestroyed()) {
      return { accepted: false } satisfies DesktopInvokeResponseMap['desktop:window:close'];
    }

    win.close();
    return { accepted: true } satisfies DesktopInvokeResponseMap['desktop:window:close'];
  });

  ipcMain.handle('desktop:window:state', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win || win.isDestroyed()) {
      return {
        isMaximized: false,
        isFullScreen: false,
        isMinimized: false,
        isVisible: false
      } satisfies DesktopInvokeResponseMap['desktop:window:state'];
    }

    return {
      isMaximized: win.isMaximized(),
      isFullScreen: win.isFullScreen(),
      isMinimized: win.isMinimized(),
      isVisible: win.isVisible()
    } satisfies DesktopInvokeResponseMap['desktop:window:state'];
  });
};

export const broadcastDesktopUpdateEvent = (payload: DesktopUpdateEventPayload): void => {
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send('desktop:update:event', payload);
  }
};

export const broadcastDesktopSystemEvent = (payload: DesktopSystemEventPayload): void => {
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send('desktop:system:event', payload);
  }
};
