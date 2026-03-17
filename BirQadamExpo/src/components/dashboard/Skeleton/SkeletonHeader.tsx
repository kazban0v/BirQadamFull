import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';

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
          backgroundColor: style?.backgroundColor || '#E5E7EB',
          opacity: pulseAnim,
        },
        style,
      ]}
    />
  );
};

export const SkeletonHeader: React.FC = () => (
  <View style={styles.header}>
    <View style={styles.headerLeft}>
      <Skeleton width={48} height={48} borderRadius={24} />
      <View style={{ marginLeft: 12, flex: 1 }}>
        <Skeleton width={120} height={14} style={{ marginBottom: 8 }} />
        <Skeleton width={150} height={18} />
      </View>
    </View>
    <Skeleton width={40} height={40} borderRadius={20} />
  </View>
);

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
});

