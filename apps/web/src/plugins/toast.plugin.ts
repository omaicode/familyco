import type { App, InjectionKey, Ref } from 'vue';
import { inject, readonly, ref } from 'vue';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  durationMs: number;
  createdAt: string;
}

export interface ToastInput {
  type: ToastType;
  message: string;
  durationMs?: number;
}

export interface ToastApi {
  toasts: Readonly<Ref<readonly ToastItem[]>>;
  show: (input: ToastInput) => string;
  success: (message: string, durationMs?: number) => string;
  error: (message: string, durationMs?: number) => string;
  info: (message: string, durationMs?: number) => string;
  dismiss: (id: string) => void;
  clear: () => void;
}

const TOAST_SYMBOL: InjectionKey<ToastApi> = Symbol('familyco.toast');
const DEFAULT_TOAST_DURATION_MS = 4000;
const MAX_TOASTS = 4;

const toastItems = ref<ToastItem[]>([]);
const dismissalTimers = new Map<string, ReturnType<typeof setTimeout>>();
let fallbackSequence = 0;

const toastApi: ToastApi = {
  toasts: readonly(toastItems),
  show(input) {
    const id = createToastId();
    const item: ToastItem = {
      id,
      type: input.type,
      message: input.message,
      durationMs: input.durationMs ?? DEFAULT_TOAST_DURATION_MS,
      createdAt: new Date().toISOString()
    };

    toastItems.value = [...toastItems.value, item].slice(-MAX_TOASTS);

    if (toastItems.value.length === MAX_TOASTS) {
      const visibleIds = new Set(toastItems.value.map((toast) => toast.id));
      for (const timerId of dismissalTimers.keys()) {
        if (!visibleIds.has(timerId)) {
          clearScheduledDismissal(timerId);
        }
      }
    }

    if (item.durationMs > 0) {
      scheduleDismissal(item.id, item.durationMs);
    }

    return id;
  },
  success(message, durationMs) {
    return toastApi.show({ type: 'success', message, durationMs });
  },
  error(message, durationMs) {
    return toastApi.show({ type: 'error', message, durationMs });
  },
  info(message, durationMs) {
    return toastApi.show({ type: 'info', message, durationMs });
  },
  dismiss(id) {
    clearScheduledDismissal(id);
    toastItems.value = toastItems.value.filter((toast) => toast.id !== id);
  },
  clear() {
    for (const id of dismissalTimers.keys()) {
      clearScheduledDismissal(id);
    }
    toastItems.value = [];
  }
};

export const toastPlugin = {
  install(app: App): void {
    app.provide(TOAST_SYMBOL, toastApi);
  }
};

export function useToast(): ToastApi {
  return inject(TOAST_SYMBOL, toastApi);
}

function createToastId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  fallbackSequence += 1;
  return `toast-${Date.now()}-${fallbackSequence}`;
}

function scheduleDismissal(id: string, durationMs: number): void {
  clearScheduledDismissal(id);
  dismissalTimers.set(id, setTimeout(() => {
    toastApi.dismiss(id);
  }, durationMs));
}

function clearScheduledDismissal(id: string): void {
  const timer = dismissalTimers.get(id);
  if (timer) {
    clearTimeout(timer);
    dismissalTimers.delete(id);
  }
}
