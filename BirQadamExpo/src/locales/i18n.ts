import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ru } from './ru';
import { en } from './en';
import { kk } from './kk';

const extracted = require('../../localization-extract-clean.json') as {
  mapping?: Record<string, string>;
};

const translations: Record<string, typeof ru> = {
  ru,
  en,
  kk,
};

const extractedMapping = extracted.mapping || {};

const manualFallbacks: Record<string, string> = {
  'dashboard.welcomeBack': 'С возвращением,',
};

export type TranslationKeys = string;

interface I18nContextType {
  language: string;
  t: (key: string) => string;
  setLanguage: (lang: string) => Promise<void>;
  changeLanguage: (lang: string) => void;
}

const I18nContext = createContext<I18nContextType>({
  language: 'ru',
  t: (key) => key,
  setLanguage: async () => {},
  changeLanguage: () => {},
});

let currentLanguage = 'ru';

const getNestedTranslation = (dict: any, key: string): string | null => {
  const keys = key.split('.');
  let value = dict;

  for (const part of keys) {
    if (value && typeof value === 'object' && part in value) {
      value = value[part];
    } else {
      return null;
    }
  }

  return typeof value === 'string' ? value : null;
};

const getTranslation = (lang: string, key: string): string => {
  const fromLocale = getNestedTranslation(translations[lang] || translations.ru, key);
  if (fromLocale && fromLocale !== key) {
    return fromLocale;
  }

  const fromExtracted = extractedMapping[key];
  if (fromExtracted) {
    return fromExtracted;
  }

  const fromManual = manualFallbacks[key];
  if (fromManual) {
    return fromManual;
  }

  const fromRussianLocale = getNestedTranslation(translations.ru, key);
  if (fromRussianLocale) {
    return fromRussianLocale;
  }

  return key;
};

export const I18nProvider: React.FC<{ children: React.ReactNode; initialLang?: string }> = ({
  children,
  initialLang = 'ru',
}) => {
  const [language] = useState(initialLang);

  const setLanguage = useCallback(async (_lang: string) => {
    currentLanguage = 'ru';
    try {
      await AsyncStorage.setItem('app_language', 'ru');
    } catch {}
  }, []);

  const changeLanguage = useCallback((_lang: string) => {
    currentLanguage = 'ru';
  }, []);

  const value = useMemo<I18nContextType>(
    () => ({
      language,
      t: (key: string) => getTranslation('ru', key),
      setLanguage,
      changeLanguage,
    }),
    [language, setLanguage, changeLanguage]
  );

  return React.createElement(I18nContext.Provider, { value }, children);
};

export const useTranslation = (): I18nContextType => useContext(I18nContext);

export const setLanguage = async (_lang: string) => {
  currentLanguage = 'ru';
  try {
    await AsyncStorage.setItem('app_language', 'ru');
  } catch {}
};

export const initLanguage = async (): Promise<string> => {
  currentLanguage = 'ru';
  try {
    await AsyncStorage.setItem('app_language', 'ru');
  } catch {}
  return 'ru';
};

export const getLanguage = () => currentLanguage;

export { ru };
