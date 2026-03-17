import AsyncStorage from '@react-native-async-storage/async-storage';

const ONBOARDING_COMPLETE_KEY = '@birqadam:onboarding_complete';
const ONBOARDING_CURRENT_PAGE_KEY = '@birqadam:onboarding_current_page';

export const OnboardingStorage = {
  // Проверка, завершен ли онбординг
  isCompleted: async (): Promise<boolean> => {
    try {
      const value = await AsyncStorage.getItem(ONBOARDING_COMPLETE_KEY);
      return value === 'true';
    } catch (error) {
      console.error('Error reading onboarding status:', error);
      return false;
    }
  },

  // Отметить онбординг как завершенный
  setCompleted: async (): Promise<void> => {
    try {
      await AsyncStorage.setItem(ONBOARDING_COMPLETE_KEY, 'true');
    } catch (error) {
      console.error('Error saving onboarding status:', error);
    }
  },

  // Сбросить статус онбординга (для тестирования)
  reset: async (): Promise<void> => {
    try {
      await AsyncStorage.removeItem(ONBOARDING_COMPLETE_KEY);
      await AsyncStorage.removeItem(ONBOARDING_CURRENT_PAGE_KEY);
    } catch (error) {
      console.error('Error resetting onboarding:', error);
    }
  },

  // Получить текущую страницу (для восстановления)
  getCurrentPage: async (): Promise<number> => {
    try {
      const value = await AsyncStorage.getItem(ONBOARDING_CURRENT_PAGE_KEY);
      return value ? parseInt(value, 10) : 0;
    } catch (error) {
      console.error('Error reading current page:', error);
      return 0;
    }
  },

  // Сохранить текущую страницу
  setCurrentPage: async (page: number): Promise<void> => {
    try {
      await AsyncStorage.setItem(ONBOARDING_CURRENT_PAGE_KEY, page.toString());
    } catch (error) {
      console.error('Error saving current page:', error);
    }
  },
};

// Экспорт для обратной совместимости с AppNavigator
export const StorageUtil = {
  isOnboardingComplete: OnboardingStorage.isCompleted,
  setOnboardingComplete: OnboardingStorage.setCompleted,
  reset: OnboardingStorage.reset,
};
