export type DesktopInvokeChannel =
  | 'desktop:health'
  | 'desktop:audit:list'
  | 'desktop:agents:list'
  | 'desktop:update:check'
  | 'desktop:update:install'
  | 'desktop:dialog:open-directory';

export type DesktopEventChannel = 'desktop:update:event' | 'desktop:system:event';

export interface DesktopUpdateEventPayload {
  status:
    | 'idle'
    | 'checking'
    | 'available'
    | 'not-available'
    | 'downloading'
    | 'downloaded'
    | 'error';
  version?: string;
  percent?: number;
  message?: string;
}

export interface DesktopSystemEventPayload {
  type: 'startup-warning';
  message: string;
}

export interface DesktopInvokeRequestMap {
  'desktop:health': {
    path?: string;
  };
  'desktop:audit:list': {
    limit?: number;
  };
  'desktop:agents:list': Record<string, never>;
  'desktop:update:check': Record<string, never>;
  'desktop:update:install': Record<string, never>;
  'desktop:dialog:open-directory': Record<string, never>;
}
export interface DesktopInvokeResponseMap {
  'desktop:health': {
    status: string;
  };
  'desktop:audit:list': unknown;
  'desktop:agents:list': unknown;
  'desktop:update:check': {
    accepted: boolean;
  };
  'desktop:update:install': {
    accepted: boolean;
  };
  'desktop:dialog:open-directory': {
    canceled: boolean;
    filePaths: string[];
  };
}
