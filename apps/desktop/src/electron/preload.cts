import { contextBridge, ipcRenderer } from 'electron';

import type {
  DesktopInvokeChannel,
  DesktopInvokeRequestMap,
  DesktopInvokeResponseMap
} from './ipc/ipc.types.js';

export interface DesktopRuntimeConfig {
  apiBaseUrl: string;
  apiKey?: string;
}

export interface DesktopRendererApi {
  invoke: <TChannel extends DesktopInvokeChannel>(
    channel: TChannel,
    payload: DesktopInvokeRequestMap[TChannel]
  ) => Promise<DesktopInvokeResponseMap[TChannel]>;
}

const desktopApi: DesktopRendererApi = {
  invoke: async (channel, payload) => {
    return ipcRenderer.invoke(channel, payload);
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
  apiKey: readArgValue('--familyco-api-key=')
};

contextBridge.exposeInMainWorld('familycoDesktop', desktopApi);
contextBridge.exposeInMainWorld('familycoDesktopConfig', runtimeConfig);
