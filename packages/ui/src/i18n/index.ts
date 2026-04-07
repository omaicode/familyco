import en from "./en";
import vi from "./vi";

export type SupportedLocale = 'en' | 'vi';

export interface SupportedLocaleOption {
  value: SupportedLocale;
  label: string;
  nativeLabel: string;
}

export type TranslationParams = Record<string, string | number | boolean | null | undefined>;

type TranslationTable = Record<string, string>;

export const supportedLocales: SupportedLocaleOption[] = [
  {
    value: 'en',
    label: 'English',
    nativeLabel: 'English'
  },
  {
    value: 'vi',
    label: 'Vietnamese',
    nativeLabel: 'Tiếng Việt'
  }
];

const englishMessages: TranslationTable = en;

const vietnameseMessages: TranslationTable = vi;

const translationTables: Record<SupportedLocale, TranslationTable> = {
  en: englishMessages,
  vi: {
    ...englishMessages,
    ...vietnameseMessages
  }
};

export const isSupportedLocale = (value: unknown): value is SupportedLocale => value === 'en' || value === 'vi';

export const coerceSupportedLocale = (value: unknown, fallback: SupportedLocale = 'en'): SupportedLocale => {
  if (isSupportedLocale(value)) {
    return value;
  }

  return fallback;
};

export const translate = (
  locale: SupportedLocale,
  key: string,
  params: TranslationParams = {}
): string => {
  const table = translationTables[locale] ?? translationTables.en;
  const template = table[key] ?? translationTables.en[key] ?? key;

  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, paramKey: string) => {
    const value = params[paramKey];
    return value === undefined || value === null ? '' : String(value);
  });
};
