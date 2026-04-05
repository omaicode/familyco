import { contextBridge, ipcRenderer } from 'electron';

import type {
  DesktopInvokeChannel,
  DesktopInvokeRequestMap,
  DesktopInvokeResponseMap
} from './ipc/ipc.types.js';

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

contextBridge.exposeInMainWorld('familycoDesktop', desktopApi);
