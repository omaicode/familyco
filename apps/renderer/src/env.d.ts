/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue';

  const component: DefineComponent<Record<string, never>, Record<string, never>, unknown>;
  export default component;
}

declare global {
  interface Window {
    familycoDesktop?: {
      invoke: (channel: string, payload: unknown) => Promise<unknown>;
      on: (channel: string, handler: (payload: unknown) => void) => () => void;
    };
    familycoDesktopConfig?: {
      apiBaseUrl?: string;
      apiKey?: string;
    };
  }
}

export {};
