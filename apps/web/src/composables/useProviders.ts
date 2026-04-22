import type { ProviderListItem } from '@familyco/ui';
import { ref } from 'vue';

import { uiRuntime } from '../runtime';

interface ProviderOperationResult {
  ok: boolean;
  error?: string;
}

interface DesktopOAuthStartResult {
  ok: boolean;
  providerId: string;
  candidateTokens: string[];
  cookieCount: number;
}

const logOAuth = (...args: unknown[]): void => {
  if (import.meta.env.DEV) {
    console.info('[oauth-ui]', ...args);
  }
};

export function useProviders() {
  const providers = ref<ProviderListItem[]>([]);
  const loading = ref(false);
  const busy = ref<Record<string, boolean>>({});

  const loadProviders = async (): Promise<void> => {
    loading.value = true;
    try {
      providers.value = await uiRuntime.api.listProviders();
    } finally {
      loading.value = false;
    }
  };

  const runBusy = async (providerId: string, action: () => Promise<ProviderOperationResult>): Promise<ProviderOperationResult> => {
    busy.value = { ...busy.value, [providerId]: true };
    try {
      return await action();
    } finally {
      busy.value = { ...busy.value, [providerId]: false };
    }
  };

  const refresh = async (): Promise<void> => {
    await Promise.all([loadProviders(), uiRuntime.stores.settings.load()]);
  };

  const connectApiKey = async (providerId: string, apiKey: string, model: string): Promise<ProviderOperationResult> => {
    return runBusy(providerId, async () => {
      try {
        await uiRuntime.api.connectProvider(providerId, { apiKey, model });
        await refresh();
        return { ok: true };
      } catch (error) {
        return { ok: false, error: toErrorMessage(error) };
      }
    });
  };

  const connectOAuth = async (providerId: string, model: string): Promise<ProviderOperationResult> => {
    return runBusy(providerId, async () => {
      try {
        logOAuth('connect requested', { providerId, model });

        if (typeof window === 'undefined' || typeof window.familycoDesktop?.invoke !== 'function') {
          throw new Error('OAUTH_DESKTOP_ONLY:OAuth connections are only available in Electron runtime');
        }

        const result = await window.familycoDesktop.invoke('desktop:provider:oauth:start', {
          providerId
        }) as DesktopOAuthStartResult;

        logOAuth('ipc result', {
          providerId,
          ok: result.ok,
          candidateTokenCount: result.candidateTokens.length,
          cookieCount: result.cookieCount
        });

        if (!result.ok || result.candidateTokens.length === 0) {
          throw new Error('OAUTH_TOKEN_INVALID:No usable OAuth token was captured');
        }

        await uiRuntime.api.connectProviderOAuth(providerId, {
          candidateTokens: result.candidateTokens,
          model
        });
        await refresh();
        logOAuth('provider oauth connected', { providerId, model });
        return { ok: true };
      } catch (error) {
        logOAuth('connect failed', {
          providerId,
          error: toErrorMessage(error)
        });
        return { ok: false, error: toErrorMessage(error) };
      }
    });
  };

  const disconnectProvider = async (providerId: string): Promise<ProviderOperationResult> => {
    return runBusy(providerId, async () => {
      try {
        await uiRuntime.api.disconnectProvider(providerId);
        await refresh();
        return { ok: true };
      } catch (error) {
        return { ok: false, error: toErrorMessage(error) };
      }
    });
  };

  const selectProvider = async (providerId: string, model: string): Promise<ProviderOperationResult> => {
    return runBusy(providerId, async () => {
      try {
        await uiRuntime.api.selectProvider(providerId, { model });
        await refresh();
        return { ok: true };
      } catch (error) {
        return { ok: false, error: toErrorMessage(error) };
      }
    });
  };

  return {
    providers,
    loading,
    busy,
    loadProviders,
    connectApiKey,
    connectOAuth,
    disconnectProvider,
    selectProvider
  };
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'API_ERROR:Unknown error';
}
