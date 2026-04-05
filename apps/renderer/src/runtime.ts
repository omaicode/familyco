import { bootstrapFamilyCoUI, type UIBootstrap } from '@familyco/ui';

const baseURL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:4000';
const apiKey = import.meta.env.VITE_API_KEY;
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
