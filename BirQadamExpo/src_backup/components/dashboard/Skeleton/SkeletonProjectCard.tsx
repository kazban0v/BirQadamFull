import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { appColors } from '../../../theme';

const Skeleton = ({ width, height, borderRadius = 8, style }: { width?: number | string; height?: number; borderRadius?: number; style?: any }) => {
  const pulseAnim = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.4,
          duration: 1200,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => {
      pulse.stop();
      pulseAnim.setValue(0.4);
    };
  }, [pulseAnim]);

  return (
    <Animated.View
      style={[
        {
          width: width || '100%',
          height: height || 20,
          borderRadius,
          backgroundColor: style?.backgroundColor || appColors.surfaceMuted,
          opacity: pulseAnim,
        },
        style,
      ]}
    />
  );
};

export const SkeletonProjectCard: React.FC = () => (
  <View style={styles.projectCard}>
    <Skeleton width="100%" height={180} borderRadius={0} />
    <View style={styles.projectContent}>
      <Skeleton width="80%" height={20} style={{ marginBottom: 12 }} />
      <View style={{ flexDirection: 'row', marginBottom: 8 }}>
        <Skeleton width={100} height={16} style={{ marginRight: 12 }} />
        <Skeleton width={100} height={16} />
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 }}>
        <Skeleton width={100} height={14} />
        <Skeleton width={80} height={14} />
      </View>
      <Skeleton width="100%" height={40} borderRadius={8} />
    </View>
  </View>
);

const styles = StyleSheet.create({
  projectCard: {
    backgroundColor: appColors.surface,
    borderRadius: 20,
    marginBottom: 16,
    overflow: 'hidden',
  },
  projectContent: {
    padding: 16,
  },
});


