import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

/** Лёгкий отклик: закрытие модалки, второстепенное */
export function hapticLight(): void {
  if (Platform.OS === 'web') return;
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

/** Средний: основной CTA */
export function hapticMedium(): void {
  if (Platform.OS === 'web') return;
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
}

export function hapticSuccess(): void {
  hapticMedium();
}
