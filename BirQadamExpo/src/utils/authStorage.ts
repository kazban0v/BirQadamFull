import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const isWeb = Platform.OS === 'web';

async function canUseSecureStore(): Promise<boolean> {
  if (isWeb) {
    return false;
  }

  try {
    return await SecureStore.isAvailableAsync();
  } catch {
    return false;
  }
}

export const authStorage = {
  async getItem(key: string): Promise<string | null> {
    if (await canUseSecureStore()) {
      return SecureStore.getItemAsync(key);
    }

    return AsyncStorage.getItem(key);
  },

  async setItem(key: string, value: string): Promise<void> {
    if (await canUseSecureStore()) {
      await SecureStore.setItemAsync(key, value);
      return;
    }

    await AsyncStorage.setItem(key, value);
  },

  async removeItem(key: string): Promise<void> {
    if (await canUseSecureStore()) {
      await SecureStore.deleteItemAsync(key);
      return;
    }

    await AsyncStorage.removeItem(key);
  },
};
