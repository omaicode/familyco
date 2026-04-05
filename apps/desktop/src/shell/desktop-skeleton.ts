export interface EmbeddedServerConfig {
  enabled: boolean;
  host: string;
  port: number;
  healthEndpoint: string;
}

export interface DesktopWindowConfig {
  width: number;
  height: number;
  minWidth: number;
  minHeight: number;
  title: string;
}

export interface DesktopShellBlueprint {
  appName: string;
  embeddedServer: EmbeddedServerConfig;
  rendererBaseURL: string;
  window: DesktopWindowConfig;
  preloadApiContract: {
    invokeChannel: string;
    subscribeChannel: string;
  };
}

export const desktopShellBlueprint: DesktopShellBlueprint = {
  appName: 'FamilyCo Desktop',
  embeddedServer: {
    enabled: true,
    host: '127.0.0.1',
    port: 3040,
    healthEndpoint: '/health'
  },
  rendererBaseURL: 'http://127.0.0.1:3040',
  window: {
    width: 1440,
    height: 900,
    minWidth: 1120,
    minHeight: 720,
    title: 'FamilyCo'
  },
  preloadApiContract: {
    invokeChannel: 'familyco:invoke',
    subscribeChannel: 'familyco:subscribe'
  }
};
