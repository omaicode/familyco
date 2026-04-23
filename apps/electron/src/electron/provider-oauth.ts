import { BrowserWindow, session, type Cookie } from 'electron';

interface ProviderOAuthConfig {
  loginUrl: string;
  allowedDomains: string[];
  preferredCookieNames: string[];
}

export interface ProviderOAuthCaptureResult {
  providerId: string;
  candidateTokens: string[];
  cookieCount: number;
}

const DEFAULT_OPENAI_COOKIE_NAMES = [
  'access_token',
  'accesstoken',
  'token',
  'session-token',
  'sessiontoken',
  '__secure-next-auth.session-token',
  '__secure-authjs.session-token',
  'next-auth.session-token',
  'authjs.session-token'
];

// Chromium emits ERR_ABORTED (-3) for provisional/redirected navigations.
// Treating that as fatal closes the OAuth window before the login page appears.
const NON_FATAL_NAVIGATION_ERROR_CODES = new Set([-3]);

export function getProviderOAuthConfig(providerId: string): ProviderOAuthConfig | null {
  if (providerId !== 'openai') {
    return null;
  }

  return {
    loginUrl: process.env.FAMILYCO_OPENAI_OAUTH_LOGIN_URL?.trim() || 'https://platform.openai.com/login',
    allowedDomains: readCsvEnv('FAMILYCO_OPENAI_OAUTH_DOMAINS', [
      'openai.com',
      'auth.openai.com',
      'platform.openai.com',
      'chatgpt.com'
    ]),
    preferredCookieNames: readCsvEnv(
      'FAMILYCO_OPENAI_OAUTH_COOKIE_NAMES',
      DEFAULT_OPENAI_COOKIE_NAMES
    ).map((value) => value.toLowerCase())
  };
}

export async function captureProviderOAuthTokens(
  providerId: string,
  ownerWindow?: BrowserWindow
): Promise<ProviderOAuthCaptureResult> {
  const config = getProviderOAuthConfig(providerId);
  if (!config) {
    throw new Error(`PROVIDER_OAUTH_UNSUPPORTED:${providerId}`);
  }

  console.info('[oauth] capture start', {
    providerId,
    hasOwnerWindow: Boolean(ownerWindow && !ownerWindow.isDestroyed())
  });

  const partition = `provider-oauth-${providerId}-${Date.now()}`;
  const authSession = session.fromPartition(partition, { cache: false });
  const authWindow = new BrowserWindow({
    width: 980,
    height: 760,
    // Avoid modal child windows in dev/Linux because they can fail to appear above frameless shells.
    parent: undefined,
    modal: false,
    show: true,
    autoHideMenuBar: true,
    title: `Connect ${providerId}`,
    webPreferences: {
      partition,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true
    }
  });

  return new Promise<ProviderOAuthCaptureResult>((resolve, reject) => {
    let settled = false;
    let hasLoadedInitialPage = false;
    const captureArmDelayMs = Number(process.env.FAMILYCO_OAUTH_CAPTURE_ARM_DELAY_MS ?? 5_000);
    const captureArmedAt = Date.now() + (Number.isFinite(captureArmDelayMs) ? captureArmDelayMs : 5_000);
    const captureTimeoutMs = Number(process.env.FAMILYCO_OAUTH_CAPTURE_TIMEOUT_MS ?? 120_000);
    let timeoutHandle: ReturnType<typeof setTimeout> | null = setTimeout(() => {
      void fail(new Error('OAUTH_CAPTURE_TIMEOUT'));
    }, Number.isFinite(captureTimeoutMs) ? captureTimeoutMs : 120_000);

    const cleanup = async (): Promise<void> => {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
        timeoutHandle = null;
      }

      authSession.cookies.removeAllListeners('changed');
      authWindow.webContents.removeListener('did-finish-load', onNavigation);
      authWindow.webContents.removeListener('did-navigate', onNavigation);
      authWindow.webContents.removeListener('did-navigate-in-page', onNavigation);
      authWindow.webContents.removeListener('did-redirect-navigation', onNavigation);
      authWindow.webContents.removeListener('did-fail-load', onLoadFailed);
      if (!authWindow.isDestroyed()) {
        authWindow.removeAllListeners('closed');
        authWindow.close();
      }
      await authSession.clearStorageData();
    };

    const finish = async (result: ProviderOAuthCaptureResult): Promise<void> => {
      if (settled) {
        return;
      }
      settled = true;
      console.info('[oauth] capture success', {
        providerId,
        candidateTokenCount: result.candidateTokens.length,
        cookieCount: result.cookieCount
      });
      await cleanup();
      resolve(result);
    };

    const fail = async (error: Error): Promise<void> => {
      if (settled) {
        return;
      }
      settled = true;
      console.error('[oauth] capture failed', {
        providerId,
        error: error.message
      });
      await cleanup();
      reject(error);
    };

    const tryCapture = async (): Promise<void> => {
      if (!hasLoadedInitialPage) {
        return;
      }

      if (Date.now() < captureArmedAt) {
        return;
      }

      const currentUrl = authWindow.webContents.getURL();
      if (!matchesAllowedUrl(currentUrl, config.allowedDomains)) {
        return;
      }

      const cookies = await authSession.cookies.get({});
      const candidateTokens = collectCandidateTokens(cookies, config);
      if (candidateTokens.length === 0) {
        return;
      }

      await finish({
        providerId,
        candidateTokens,
        cookieCount: cookies.length
      });
    };

    const onNavigation = (): void => {
      void tryCapture();
    };

    authWindow.once('ready-to-show', () => {
      if (!authWindow.isDestroyed()) {
        authWindow.show();
        authWindow.focus();
      }
    });

    authWindow.show();
    authWindow.focus();

    const onLoadFailed = (
      _event: Electron.Event,
      errorCode: number,
      errorDescription: string,
      validatedURL: string,
      isMainFrame?: boolean,
    ): void => {
      if (isMainFrame === false) {
        return;
      }

      if (NON_FATAL_NAVIGATION_ERROR_CODES.has(errorCode)) {
        console.warn('[oauth] ignoring non-fatal navigation failure', {
          providerId,
          errorCode,
          errorDescription,
          validatedURL
        });
        return;
      }

      void fail(new Error(`OAUTH_WINDOW_LOAD_FAILED:${errorCode}:${errorDescription}:${validatedURL}`));
    };

    authWindow.on('closed', () => {
      if (!settled) {
        void fail(new Error('OAUTH_WINDOW_CLOSED'));
      }
    });

    authSession.cookies.on('changed', () => {
      void tryCapture();
    });

    authWindow.webContents.on('did-finish-load', onNavigation);
    authWindow.webContents.on('did-navigate', onNavigation);
    authWindow.webContents.on('did-navigate-in-page', onNavigation);
    authWindow.webContents.on('did-redirect-navigation', onNavigation);
    authWindow.webContents.on('did-fail-load', onLoadFailed);

    authWindow.webContents.once('did-finish-load', () => {
      hasLoadedInitialPage = true;
      console.info('[oauth] capture armed', {
        providerId,
        captureArmDelayMs,
        currentUrl: authWindow.webContents.getURL()
      });
      void tryCapture();
    });

    void authWindow.loadURL(config.loginUrl).catch((error: unknown) => {
      void fail(error instanceof Error ? error : new Error('OAUTH_WINDOW_LOAD_FAILED'));
    });
  });
}

function matchesAllowedUrl(urlValue: string, allowedDomains: string[]): boolean {
  if (!urlValue || urlValue.trim().length === 0) {
    return false;
  }

  try {
    const parsed = new URL(urlValue);
    return matchesAllowedDomain(parsed.hostname, allowedDomains);
  } catch {
    return false;
  }
}

function collectCandidateTokens(cookies: Cookie[], config: ProviderOAuthConfig): string[] {
  const domainCookies = cookies.filter(
    (cookie) => typeof cookie.domain === 'string' && matchesAllowedDomain(cookie.domain, config.allowedDomains)
  );
  const prioritizedCookies = domainCookies
    .filter((cookie) => cookie.value.trim().length > 0)
    .sort((left, right) => scoreCookie(right, config) - scoreCookie(left, config));

  const source = prioritizedCookies.filter((cookie) =>
    config.preferredCookieNames.includes(cookie.name.toLowerCase())
  );

  return Array.from(new Set(source
    .map((cookie) => cookie.value.trim())
    .filter((value) => value.length >= 24)))
    .slice(0, 12);
}

function matchesAllowedDomain(domain: string, allowedDomains: string[]): boolean {
  const normalized = domain.replace(/^\./u, '').toLowerCase();
  return allowedDomains.some((candidate) => {
    const expected = candidate.replace(/^\./u, '').toLowerCase();
    return normalized === expected || normalized.endsWith(`.${expected}`);
  });
}

function scoreCookie(cookie: Cookie, config: ProviderOAuthConfig): number {
  const lowerName = cookie.name.toLowerCase();
  const preferredIndex = config.preferredCookieNames.indexOf(lowerName);
  const preferredScore = preferredIndex >= 0 ? config.preferredCookieNames.length - preferredIndex : 0;
  const semanticBoost =
    (lowerName.includes('access') ? 20 : 0) +
    (lowerName.includes('token') ? 10 : 0) +
    (lowerName.includes('session') ? 4 : 0);

  return preferredScore * 100 + semanticBoost + Math.min(cookie.value.length, 64);
}

function readCsvEnv(name: string, fallback: string[]): string[] {
  const raw = process.env[name];
  if (!raw || raw.trim().length === 0) {
    return fallback;
  }

  const values = raw
    .split(',')
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

  return values.length > 0 ? values : fallback;
}
