import { BrowserWindow, dialog, ipcMain } from 'electron';

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
