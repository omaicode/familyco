import path from 'node:path';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { app, BrowserWindow, dialog, type MessageBoxOptions } from 'electron';
import pkg, { type UpdateInfo } from 'electron-updater';
import type { DesktopUpdateEventPayload } from './ipc/ipc.types.js';

const { autoUpdater } = pkg;

export interface DesktopUpdaterRuntime {
  checkForUpdates: () => Promise<boolean>;
  downloadUpdate: () => Promise<boolean>;
  installDownloadedUpdate: () => Promise<boolean>;
  getUpdateState: () => DesktopUpdateEventPayload;
}

export interface StartDesktopUpdaterOptions {
  emit: (payload: DesktopUpdateEventPayload) => void;
}

const UPDATE_CHECK_INTERVAL_MS = 30 * 60 * 1000;
const UPDATE_PREFERENCES_FILE = 'updater-preferences.json';

interface UpdatePreferences {
  skippedVersion?: string;
}

const HTML_TAG_REGEX = /<\/?[a-z][^>]*>/i;
const HTML_ENTITY_REGEX = /&(?:#\d+|#x[0-9a-f]+|[a-z]+);/i;

const decodeCodePoint = (value: number, fallback: string): string => {
  if (!Number.isInteger(value) || value < 0 || value > 0x10FFFF) {
    return fallback;
  }

  try {
    return String.fromCodePoint(value);
  } catch {
    return fallback;
  }
};

const decodeHtmlEntities = (value: string): string =>
  value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#x([0-9a-f]+);/gi, (match, hex: string) => decodeCodePoint(Number.parseInt(hex, 16), match))
    .replace(/&#(\d+);/g, (match, num: string) => decodeCodePoint(Number.parseInt(num, 10), match));

const stripHtmlToText = (value: string): string => {
  const withBreaks = value
    .replace(/<\s*(script|style)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
    .replace(/<\s*br\s*\/?\s*>/gi, '\n')
    .replace(/<\s*li\b[^>]*>/gi, '- ')
    .replace(/<\s*\/\s*(p|div|li|h1|h2|h3|h4|h5|h6|tr|table|ul|ol|pre|blockquote)\s*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ');

  return decodeHtmlEntities(withBreaks)
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .filter((line) => line.length > 0)
    .join('\n');
};

const normalizeReleaseNoteText = (value: string): string | undefined => {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return undefined;
  }

  const normalized = HTML_TAG_REGEX.test(trimmed)
    ? stripHtmlToText(trimmed)
    : (HTML_ENTITY_REGEX.test(trimmed) ? decodeHtmlEntities(trimmed) : trimmed);

  const clean = normalized.trim();
  return clean.length > 0 ? clean : undefined;
};

const formatReleaseNotes = (info: UpdateInfo): string | undefined => {
  const notes = info.releaseNotes as unknown;
  if (typeof notes === 'string') {
    return normalizeReleaseNoteText(notes);
  }

  if (!Array.isArray(notes)) {
    return undefined;
  }

  const normalized = notes
    .map((entry) => {
      if (typeof entry === 'string') {
        return normalizeReleaseNoteText(entry) ?? '';
      }

      if (!entry || typeof entry !== 'object') {
        return '';
      }

      const version = typeof (entry as { version?: unknown }).version === 'string'
        ? (entry as { version: string }).version.trim()
        : '';
      const note = typeof (entry as { note?: unknown }).note === 'string'
        ? normalizeReleaseNoteText((entry as { note: string }).note)
        : undefined;

      if (!note) {
        return '';
      }

      return version ? `Version ${version}\n${note}` : note;
    })
    .filter((item) => item.length > 0)
    .join('\n\n');

  return normalized.length > 0 ? normalized : undefined;
};

export function startDesktopUpdater(options: StartDesktopUpdaterOptions): DesktopUpdaterRuntime {
  const updateState: DesktopUpdateEventPayload = {
    status: 'idle',
    currentVersion: app.getVersion()
  };

  const emitState = (patch: Partial<DesktopUpdateEventPayload>): void => {
    Object.assign(updateState, patch);
    options.emit({ ...updateState });
  };

  if (!app.isPackaged) {
    emitState({
      status: 'idle',
      message: 'Auto-update is disabled in development mode'
    });

    return {
      checkForUpdates: async () => false,
      downloadUpdate: async () => false,
      installDownloadedUpdate: async () => false,
      getUpdateState: () => ({ ...updateState })
    };
  }

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.allowPrerelease = false;

  let isCheckingForUpdates = false;
  let isDownloadingUpdate = false;
  let isInstallingUpdate = false;
  let pendingUpdateInfo: UpdateInfo | null = null;
  let updateCheckTimer: NodeJS.Timeout | null = null;
  const preferencesPath = path.join(app.getPath('userData'), UPDATE_PREFERENCES_FILE);

  const readPreferences = (): UpdatePreferences => {
    if (!existsSync(preferencesPath)) {
      return {};
    }

    try {
      const raw = readFileSync(preferencesPath, 'utf8');
      const parsed = JSON.parse(raw) as UpdatePreferences;
      if (typeof parsed.skippedVersion === 'string' && parsed.skippedVersion.trim().length > 0) {
        return { skippedVersion: parsed.skippedVersion.trim() };
      }

      return {};
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      emitState({
        status: 'error',
        message: `Failed to read updater preferences: ${message}`
      });
      return {};
    }
  };

  const persistSkippedVersion = (version: string | undefined): void => {
    const next: UpdatePreferences = version ? { skippedVersion: version } : {};
    try {
      writeFileSync(preferencesPath, JSON.stringify(next, null, 2), 'utf8');
      emitState({ skippedVersion: version });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      emitState({
        status: 'error',
        message: `Failed to save updater preferences: ${message}`
      });
    }
  };

  const preferences = readPreferences();
  if (preferences.skippedVersion) {
    updateState.skippedVersion = preferences.skippedVersion;
  }

  autoUpdater.on('checking-for-update', () => {
    emitState({
      status: 'checking',
      message: undefined,
      percent: undefined
    });
  });

  const showUpdatePrompt = async (info: UpdateInfo): Promise<void> => {
    const releaseNotes = formatReleaseNotes(info);
    const ownerWindow = BrowserWindow.getAllWindows().find((window) => !window.isDestroyed());
    const dialogOptions: MessageBoxOptions = {
      type: 'question',
      title: 'Update available',
      message: `FamilyCo ${info.version} is available.`,
      detail: releaseNotes ?? 'A new version is available on GitHub.',
      buttons: ['Update', 'Cancel'],
      defaultId: 0,
      cancelId: 1,
      noLink: true,
      checkboxLabel: 'Skip this version',
      checkboxChecked: false
    };

    const selection = ownerWindow
      ? await dialog.showMessageBox(ownerWindow, dialogOptions)
      : await dialog.showMessageBox(dialogOptions);

    if (selection.checkboxChecked) {
      persistSkippedVersion(info.version);
    }

    if (selection.response !== 0) {
      return;
    }

    if (updateState.skippedVersion === info.version) {
      persistSkippedVersion(undefined);
    }

    await downloadUpdate();
  };

  autoUpdater.on('update-available', (info) => {
    pendingUpdateInfo = info;
    const releaseNotes = formatReleaseNotes(info);
    emitState({
      status: 'available',
      version: info.version,
      releaseNotes,
      message: undefined,
      percent: undefined
    });

    if (updateState.skippedVersion === info.version) {
      emitState({
        status: 'not-available',
        message: `Skipped version ${info.version}.`,
        percent: undefined
      });
      return;
    }

    void showUpdatePrompt(info);
  });

  autoUpdater.on('update-not-available', () => {
    pendingUpdateInfo = null;
    emitState({
      status: 'not-available',
      version: undefined,
      releaseNotes: undefined,
      percent: undefined,
      message: undefined
    });
  });

  autoUpdater.on('download-progress', (progress) => {
    emitState({
      status: 'downloading',
      version: pendingUpdateInfo?.version ?? updateState.version,
      percent: Number(progress.percent.toFixed(2))
    });
  });

  autoUpdater.on('update-downloaded', (info) => {
    pendingUpdateInfo = info;
    emitState({
      status: 'downloaded',
      version: info.version,
      percent: 100
    });
    void installDownloadedUpdate();
  });

  autoUpdater.on('error', (error) => {
    emitState({
      status: 'error',
      message: error.message
    });
  });

  const downloadUpdate = async (): Promise<boolean> => {
    if (isDownloadingUpdate || isInstallingUpdate) {
      return false;
    }

    if (!pendingUpdateInfo) {
      return false;
    }

    isDownloadingUpdate = true;
    try {
      emitState({
        status: 'downloading',
        version: pendingUpdateInfo.version,
        percent: 0
      });
      await autoUpdater.downloadUpdate();
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      emitState({
        status: 'error',
        message
      });
      return false;
    } finally {
      isDownloadingUpdate = false;
    }
  };

  const checkForUpdates = async (): Promise<boolean> => {
    if (isCheckingForUpdates || isDownloadingUpdate || isInstallingUpdate) {
      return false;
    }

    isCheckingForUpdates = true;
    try {
      await autoUpdater.checkForUpdates();
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      emitState({
        status: 'error',
        message
      });
      return false;
    } finally {
      isCheckingForUpdates = false;
    }
  };

  const installDownloadedUpdate = async (): Promise<boolean> => {
    if (isInstallingUpdate) {
      return false;
    }

    isInstallingUpdate = true;
    try {
      autoUpdater.quitAndInstall(false, true);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      emitState({
        status: 'error',
        message
      });
      isInstallingUpdate = false;
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
    downloadUpdate,
    getUpdateState: () => ({ ...updateState }),
    installDownloadedUpdate
  };
}
