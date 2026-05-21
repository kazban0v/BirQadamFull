import { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';

/**
 * Хук для создания глобальной анимации shimmer.
 * Возвращает Animated.Value, который циклично изменяется от 0 до 1.
 */
export const useShimmer = (duration = 1800) => {
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(shimmerAnim, {
        toValue: 1,
        duration: duration,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      })
    );
    
    loop.start();

    return () => {
      loop.stop();
      shimmerAnim.setValue(0);
    };
  }, [duration, shimmerAnim]);

  return shimmerAnim;
};
