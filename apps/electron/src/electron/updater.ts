import { app } from 'electron';
import pkg from 'electron-updater';
import type { DesktopUpdateEventPayload } from './ipc/ipc.types.js';

const { autoUpdater } = pkg;

export interface DesktopUpdaterRuntime {
  checkForUpdates: () => Promise<boolean>;
  installDownloadedUpdate: () => Promise<boolean>;
}

export interface StartDesktopUpdaterOptions {
  emit: (payload: DesktopUpdateEventPayload) => void;
}

const UPDATE_CHECK_INTERVAL_MS = 30 * 60 * 1000;

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
  autoUpdater.allowPrerelease = false;

  let isCheckingForUpdates = false;
  let updateCheckTimer: NodeJS.Timeout | null = null;

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
    if (isCheckingForUpdates) {
      return false;
    }

    isCheckingForUpdates = true;
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
    } finally {
      isCheckingForUpdates = false;
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
  updateCheckTimer = setInterval(() => {
    void checkForUpdates();
  }, UPDATE_CHECK_INTERVAL_MS);

  app.on('before-quit', () => {
    if (updateCheckTimer) {
      clearInterval(updateCheckTimer);
      updateCheckTimer = null;
    }
  });

  return {
    checkForUpdates,
    installDownloadedUpdate
  };
}
