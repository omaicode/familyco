import { onMounted, onUnmounted } from 'vue';

interface UseAutoReloadOptions {
  intervalMs?: number;
}

/**
 * Wraps a page's `reload()` function so it:
 * 1. Fires on `onMounted` as normal.
 * 2. Also fires when the server becomes reachable after being unavailable
 *    (via the global `fc:server-ready` custom event dispatched by App.vue).
 *
 * This handles the race condition where the embedded Fastify server (Desktop)
 * or a remote server is not yet ready when the renderer first mounts,
 * causing API calls to fail silently and leaving data empty.
 */
export function useAutoReload(
  reload: () => Promise<void> | void,
  options: UseAutoReloadOptions = {}
): void {
  let isReloading = false;
  let pollTimer: ReturnType<typeof setInterval> | null = null;

  const runReload = async (): Promise<void> => {
    if (isReloading) {
      return;
    }

    isReloading = true;
    try {
      await reload();
    } finally {
      isReloading = false;
    }
  };

  const handleServerReady = () => { void runReload(); };

  onMounted(async () => {
    await runReload();
    window.addEventListener('fc:server-ready', handleServerReady);

    if (options.intervalMs && options.intervalMs > 0) {
      pollTimer = setInterval(() => {
        void runReload();
      }, options.intervalMs);
    }
  });

  onUnmounted(() => {
    window.removeEventListener('fc:server-ready', handleServerReady);

    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  });
}
