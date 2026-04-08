import { app } from 'electron';
import { autoUpdater } from 'electron-updater';

import type { DesktopUpdateEventPayload } from './ipc/ipc.types.js';

export interface DesktopUpdaterRuntime {
  checkForUpdates: () => Promise<boolean>;
  installDownloadedUpdate: () => Promise<boolean>;
}

export interface StartDesktopUpdaterOptions {
  emit: (payload: DesktopUpdateEventPayload) => void;
}

export function startDesktopUpdater(options: StartDesktopUpdaterOptions): DesktopUpdaterRuntime {
  if (!app.isPackaged) {
    options.emit({
      status: 'idle',
      message: 'Auto-update is disabled in development mode'
    });

    return {
      checkForUpdates: async () => false,
      installDownloadedUpdate: async () => false
    };
  }

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('checking-for-update', () => {
    options.emit({ status: 'checking' });
  });

  autoUpdater.on('update-available', (info) => {
    options.emit({ status: 'available', version: info.version });
  });

  autoUpdater.on('update-not-available', () => {
    options.emit({ status: 'not-available' });
  });

  autoUpdater.on('download-progress', (progress) => {
    options.emit({
      status: 'downloading',
      percent: Number(progress.percent.toFixed(2))
    });
  });

  autoUpdater.on('update-downloaded', (info) => {
    options.emit({ status: 'downloaded', version: info.version });
  });

  autoUpdater.on('error', (error) => {
    options.emit({
      status: 'error',
      message: error.message
    });
  });

  const checkForUpdates = async (): Promise<boolean> => {
    try {
      await autoUpdater.checkForUpdates();
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      options.emit({
        status: 'error',
        message
      });
      return false;
    }
  };

  const installDownloadedUpdate = async (): Promise<boolean> => {
    try {
      autoUpdater.quitAndInstall(false, true);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      options.emit({
        status: 'error',
        message
      });
      return false;
    }
  };

  void checkForUpdates();

  return {
    checkForUpdates,
    installDownloadedUpdate
  };
}
