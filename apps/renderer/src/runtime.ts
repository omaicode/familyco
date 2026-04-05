import { bootstrapFamilyCoUI, type UIBootstrap } from '@familyco/ui';

const isDesktopRuntime = (): boolean =>
  typeof window !== 'undefined' && typeof window.familycoDesktop?.invoke === 'function';

const resolveApiBaseUrl = (): string => {
  if (isDesktopRuntime()) {
    return window.familycoDesktopConfig?.apiBaseUrl?.trim() || 'http://127.0.0.1:3040';
  }

  const desktopBaseUrl = window.familycoDesktopConfig?.apiBaseUrl?.trim();
  const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();

  if (desktopBaseUrl) {
    return desktopBaseUrl;
  }

  // In production, backend URL must be explicit to prevent silent misrouting.
  if (import.meta.env.PROD && !configuredBaseUrl) {
    throw new Error('VITE_API_BASE_URL is required in production builds');
  }

  return configuredBaseUrl || 'http://127.0.0.1:4000';
};

const baseURL = resolveApiBaseUrl();
const apiKey =
  (isDesktopRuntime() ? window.familycoDesktopConfig?.apiKey || 'local-dev-api-key' : undefined) ||
  import.meta.env.VITE_API_KEY;
const token = import.meta.env.VITE_BEARER_TOKEN;

export const uiRuntime: UIBootstrap = bootstrapFamilyCoUI({
  baseURL,
  apiKey,
  bearerToken: token
});

export const applyRuntimeTheme = (): void => {
  for (const [key, value] of Object.entries(uiRuntime.cssVariables)) {
    document.documentElement.style.setProperty(key, value);
  }
};
