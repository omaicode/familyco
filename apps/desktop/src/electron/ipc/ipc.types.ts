export type DesktopInvokeChannel = 'desktop:health' | 'desktop:audit:list' | 'desktop:agents:list';

export interface DesktopInvokeRequestMap {
  'desktop:health': {
    path?: string;
  };
  'desktop:audit:list': {
    limit?: number;
  };
  'desktop:agents:list': Record<string, never>;
}

export interface DesktopInvokeResponseMap {
  'desktop:health': {
    status: string;
  };
  'desktop:audit:list': unknown;
  'desktop:agents:list': unknown;
}
