import { NativeModules, Platform } from 'react-native';
import { ru } from './ru';

type TranslationKey = keyof typeof ru.onboarding;
type NestedKey<T, P extends string = ''> = T extends object
  ? {
      [K in keyof T]: T[K] extends object
        ? NestedKey<T[K], `${P}${K & string}.`>
        : `${P}${K & string}`;
    }[keyof T]
  : never;

type TranslationKeys = NestedKey<typeof ru>;

function getTranslation(key: TranslationKeys): string {
  const keys = key.split('.');
  let value: any = ru;
  
  for (const k of keys) {
    if (value && typeof value === 'object' && k in value) {
      value = value[k];
    } else {
      return key;
    }
  }
  
  return value || key;
}

export interface TranslationType {
  t: (key: TranslationKeys) => string;
  language: string;
  changeLanguage: (lang: string) => void;
}

const getDeviceLanguage = (): string => {
  if (Platform.OS === 'ios') {
    return NativeModules.SettingsManager?.settings.AppleLocale || 'ru';
  }
  return NativeModules.I18nManager?.localeIdentifier || 'ru';
};

let currentLanguage = 'ru';

export const useTranslation = (): TranslationType => {
  return {
    t: getTranslation,
    language: currentLanguage,
    changeLanguage: (lang: string) => {
      currentLanguage = lang;
    },
  };
};

export const setLanguage = (lang: string) => {
  currentLanguage = lang;
};

export const getLanguage = () => currentLanguage;

// Экспортируем переводы для использования напрямую
export { ru };
