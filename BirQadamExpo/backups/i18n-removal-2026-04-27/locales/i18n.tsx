import React, { createContext, useContext, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ru } from './ru';
import { en } from './en';
import { kk } from './kk';

const translations: Record<string, typeof ru> = { ru, en, kk };

export type TranslationKeys = string;

function getTranslation(lang: string, key: string): string {
  const dict = translations[lang] || translations['ru'];
  const keys = key.split('.');
  let value: any = dict;
  for (const k of keys) {
    if (value && typeof value === 'object' && k in value) {
      value = value[k];
    } else {
      // fallback to ru
      let fallback: any = translations['ru'];
      for (const fk of keys) {
        if (fallback && typeof fallback === 'object' && fk in fallback) fallback = fallback[fk];
        else return key;
      }
      return typeof fallback === 'string' ? fallback : key;
    }
  }
  return typeof value === 'string' ? value : key;
}

interface I18nContextType {
  language: string;
  t: (key: string) => string;
  setLanguage: (lang: string) => Promise<void>;
}

const I18nContext = createContext<I18nContextType>({
  language: 'ru',
  t: (key) => key,
  setLanguage: async () => {},
});

let _currentLang = 'ru';

export const I18nProvider: React.FC<{ children: React.ReactNode; initialLang?: string }> = ({
  children,
  initialLang = 'ru',
}) => {
  const [language, setLang] = useState(initialLang);

  const setLanguage = useCallback(async (lang: string) => {
    _currentLang = lang;
    setLang(lang);
    try {
      await AsyncStorage.setItem('app_language', lang);
    } catch {}
  }, []);

  const t = useCallback((key: string) => getTranslation(language, key), [language]);

  return (
    <I18nContext.Provider value={{ language, t, setLanguage }}>
      {children}
    </I18nContext.Provider>
  );
};

export const useTranslation = () => useContext(I18nContext);

export const initLanguage = async (): Promise<string> => {
  try {
    const saved = await AsyncStorage.getItem('app_language');
    if (saved && translations[saved]) {
      _currentLang = saved;
      return saved;
    }
  } catch {}
  return 'ru';
};

export const getLanguage = () => _currentLang;

// legacy compat
export const setLanguage = async (lang: string) => {
  _currentLang = lang;
  try { await AsyncStorage.setItem('app_language', lang); } catch {}
};

export { ru };
