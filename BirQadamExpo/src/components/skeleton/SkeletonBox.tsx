import React from 'react';
import { View, StyleSheet, Animated, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { appColors } from '../../theme';
import { useShimmer } from './useShimmer';

interface SkeletonBoxProps {
  width?: number | string;
  height?: number | string;
  borderRadius?: number;
  style?: ViewStyle | ViewStyle[];
  isDark?: boolean;
}

export const SkeletonBox: React.FC<SkeletonBoxProps> = ({
  width = '100%',
  height = 20,
  borderRadius = 8,
  style,
  isDark = false,
}) => {
  const shimmerAnim = useShimmer();

  // Базовый цвет фона и цвет блика — мягкий контраст, не агрессивный
  const baseColor = isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(15, 23, 42, 0.06)';
  const highlightColor = isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.55)';

  // Анимация смещения: блик движется слева направо (от -100% ширины до +100%)
  // Мы используем проценты в строковом формате для поддержки разных ширин контейнера.
  const translateX = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['-100%', '100%'],
  });

  return (
    <View
      style={[
        {
          width,
          height,
          borderRadius,
          backgroundColor: baseColor,
          overflow: 'hidden',
        },
        style,
      ]}
    >
      <Animated.View
        style={{
          ...StyleSheet.absoluteFillObject,
          transform: [{ translateX }],
        }}
      >
        <LinearGradient
          colors={['transparent', highlightColor, 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFillObject}
        />
      </Animated.View>
    </View>
  );
};
