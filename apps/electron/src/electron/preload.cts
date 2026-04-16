import { contextBridge, ipcRenderer } from 'electron';

import type {
  DesktopEventChannel,
  DesktopInvokeChannel,
  DesktopInvokeRequestMap,
  DesktopInvokeResponseMap,
  DesktopSystemEventPayload,
  DesktopUpdateEventPayload
} from './ipc/ipc.types.js';

export interface DesktopRuntimeConfig {
  apiBaseUrl: string;
  apiKey?: string;
  platform: string;
}

export interface DesktopRendererApi {
  invoke: <TChannel extends DesktopInvokeChannel>(
    channel: TChannel,
    payload: DesktopInvokeRequestMap[TChannel]
  ) => Promise<DesktopInvokeResponseMap[TChannel]>;
  on: <TChannel extends DesktopEventChannel>(
    channel: TChannel,
    handler: (
      payload: TChannel extends 'desktop:update:event'
        ? DesktopUpdateEventPayload
        : DesktopSystemEventPayload
    ) => void
  ) => () => void;
}

const desktopApi: DesktopRendererApi = {
  invoke: async (channel, payload) => {
    return ipcRenderer.invoke(channel, payload);
  },
  on: (channel, handler) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: unknown) => {
      handler(payload as never);
    };

    ipcRenderer.on(channel, listener);

    return () => {
      ipcRenderer.removeListener(channel, listener);
    };
  }
};

const readArgValue = (prefix: string): string | undefined => {
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  if (!match) {
    return undefined;
  }

  const value = match.slice(prefix.length);
  return value.length > 0 ? value : undefined;
};

const runtimeConfig: DesktopRuntimeConfig = {
  apiBaseUrl: readArgValue('--familyco-api-base-url=') ?? 'http://127.0.0.1:3040',
  apiKey: readArgValue('--familyco-api-key='),
  platform: process.platform
};

contextBridge.exposeInMainWorld('familycoDesktop', desktopApi);
contextBridge.exposeInMainWorld('familycoDesktopConfig', runtimeConfig);
