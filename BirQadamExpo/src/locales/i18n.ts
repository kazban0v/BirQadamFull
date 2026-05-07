import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ru } from './ru';
import { en } from './en';
import { kk } from './kk';
import { manualFallbacks } from './manualFallbacks';
import { localizedFallbacks } from './localizedFallbacks';

const extracted = require('../../localization-extract-clean.json') as {
  mapping?: Record<string, string>;
};

type TranslationDictionary = Record<string, unknown>;
type AppLanguage = 'ru' | 'en' | 'kk';

const STORAGE_KEY = 'app_language';
const SUPPORTED_LANGUAGES: AppLanguage[] = ['ru', 'en', 'kk'];

const translations: Record<AppLanguage, TranslationDictionary> = {
  ru,
  en,
  kk,
};

const extractedMapping = extracted.mapping || {};
const localizedFallbacksByLanguage = localizedFallbacks as Partial<
  Record<AppLanguage, TranslationDictionary>
>;

export type TranslationKeys = string;

interface I18nContextType {
  language: AppLanguage;
  t: (key: string, vars?: Record<string, string | number>) => string;
  setLanguage: (lang: string) => Promise<void>;
  changeLanguage: (lang: string) => void;
}

const normalizeLanguage = (value?: string | null): AppLanguage => {
  if (value && SUPPORTED_LANGUAGES.includes(value as AppLanguage)) {
    return value as AppLanguage;
  }

  return 'ru';
};

const I18nContext = createContext<I18nContextType>({
  language: 'ru',
  t: (key) => key,
  setLanguage: async () => {},
  changeLanguage: () => {},
});

let currentLanguage: AppLanguage = 'ru';

const getNestedTranslation = (dict: unknown, key: string): string | null => {
  const parts = key.split('.');
  let value: unknown = dict;

  for (const part of parts) {
    if (value && typeof value === 'object' && part in (value as Record<string, unknown>)) {
      value = (value as Record<string, unknown>)[part];
    } else {
      return null;
    }
  }

  return typeof value === 'string' ? value : null;
};

const getTranslation = (lang: AppLanguage, key: string): string => {
  const fromLocale = getNestedTranslation(translations[lang], key);
  if (fromLocale && fromLocale !== key) {
    return fromLocale;
  }

  const localizedManual = getNestedTranslation(localizedFallbacksByLanguage[lang], key);
  if (localizedManual && localizedManual !== key) {
    return localizedManual;
  }

  if (lang === 'kk') {
    const fallbackEnglishLocale = getNestedTranslation(translations.en, key);
    if (fallbackEnglishLocale && fallbackEnglishLocale !== key) {
      return fallbackEnglishLocale;
    }

    const fallbackEnglishManual = getNestedTranslation(localizedFallbacksByLanguage.en, key);
    if (fallbackEnglishManual && fallbackEnglishManual !== key) {
      return fallbackEnglishManual;
    }
  }

  if (lang === 'ru') {
    const fromManual = manualFallbacks[key];
    if (fromManual) {
      return fromManual;
    }

    const fromExtracted = extractedMapping[key];
    if (fromExtracted) {
      return fromExtracted;
    }
  }

  return key;
};

const applyInterpolation = (
  template: string,
  vars?: Record<string, string | number>
): string => {
  if (!vars) {
    return template;
  }

  return Object.entries(vars).reduce((acc, [name, value]) => {
    const token = `{${name}}`;
    if (!acc.includes(token)) {
      return acc;
    }
    return acc.split(token).join(String(value));
  }, template);
};

const persistLanguage = async (lang: AppLanguage) => {
  currentLanguage = lang;
  await AsyncStorage.setItem(STORAGE_KEY, lang);
};

export const I18nProvider: React.FC<{ children: React.ReactNode; initialLang?: string }> = ({
  children,
  initialLang = 'ru',
}) => {
  const [language, setLanguageState] = useState<AppLanguage>(normalizeLanguage(initialLang));

  useEffect(() => {
    let isMounted = true;

    const loadStoredLanguage = async () => {
      try {
        const storedLanguage = normalizeLanguage(await AsyncStorage.getItem(STORAGE_KEY));
        currentLanguage = storedLanguage;
        if (isMounted) {
          setLanguageState(storedLanguage);
        }
      } catch {
        const fallbackLanguage = normalizeLanguage(initialLang);
        currentLanguage = fallbackLanguage;
        if (isMounted) {
          setLanguageState(fallbackLanguage);
        }
      }
    };

    void loadStoredLanguage();

    return () => {
      isMounted = false;
    };
  }, [initialLang]);

  const setLanguage = useCallback(async (lang: string) => {
    const nextLanguage = normalizeLanguage(lang);
    await persistLanguage(nextLanguage);
    setLanguageState(nextLanguage);
  }, []);

  const changeLanguage = useCallback((lang: string) => {
    const nextLanguage = normalizeLanguage(lang);
    currentLanguage = nextLanguage;
    setLanguageState(nextLanguage);
  }, []);

  const value = useMemo<I18nContextType>(
    () => ({
      language,
      t: (key: string, vars?: Record<string, string | number>) =>
        applyInterpolation(getTranslation(language, key), vars),
      setLanguage,
      changeLanguage,
    }),
    [language, setLanguage, changeLanguage]
  );

  return React.createElement(I18nContext.Provider, { value }, children);
};

export const useTranslation = (): I18nContextType => useContext(I18nContext);

export const setLanguage = async (lang: string) => {
  await persistLanguage(normalizeLanguage(lang));
};

export const initLanguage = async (): Promise<AppLanguage> => {
  try {
    const storedLanguage = normalizeLanguage(await AsyncStorage.getItem(STORAGE_KEY));
    currentLanguage = storedLanguage;
    return storedLanguage;
  } catch {
    currentLanguage = 'ru';
    return 'ru';
  }
};

export const getLanguage = (): AppLanguage => currentLanguage;

export { ru };
