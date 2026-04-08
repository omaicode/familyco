import { onMounted, onUnmounted } from 'vue';

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
export function useAutoReload(reload: () => Promise<void> | void): void {
  const handleServerReady = () => { void reload(); };

  onMounted(async () => {
    await reload();
    window.addEventListener('fc:server-ready', handleServerReady);
  });

  onUnmounted(() => {
    window.removeEventListener('fc:server-ready', handleServerReady);
  });
}
