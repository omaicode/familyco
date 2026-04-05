import { ipcMain } from 'electron';

import type { DesktopInvokeRequestMap, DesktopInvokeResponseMap } from './ipc.types.js';

export interface IpcHandlerOptions {
  apiBaseUrl: string;
  apiKey?: string;
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
};
