import { computed } from 'vue';
import {
  coerceSupportedLocale,
  supportedLocales,
  translateFamilyCo,
  type SupportedLocale,
  type TranslationParams
} from '@familyco/ui';

import { uiRuntime } from '../runtime';

export function useI18n() {
  const locale = computed(() => uiRuntime.stores.app.state.locale);

  const t = (key: string, params: TranslationParams = {}): string =>
    translateFamilyCo(uiRuntime.stores.app.state.locale, key, params);

  const setLocale = async (nextLocale: SupportedLocale): Promise<void> => {
    uiRuntime.stores.app.setLocale(nextLocale);
    await uiRuntime.stores.settings.upsert({ key: 'ui.locale', value: nextLocale });
  };

  return {
    locale,
    supportedLocales,
    t,
    setLocale,
    coerceSupportedLocale
  };
}
