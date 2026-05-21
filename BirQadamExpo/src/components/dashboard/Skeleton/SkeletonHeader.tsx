import React from 'react';
import { View, StyleSheet } from 'react-native';
import { appColors } from '../../../theme';
import { SkeletonBox } from '../../skeleton/SkeletonBox';

export const SkeletonHeader: React.FC = () => (
  <View style={styles.header}>
    <View style={styles.headerLeft}>
      <SkeletonBox width={48} height={48} borderRadius={24} />
      <View style={{ marginLeft: 12, flex: 1 }}>
        <SkeletonBox width={120} height={14} style={{ marginBottom: 8 }} />
        <SkeletonBox width={150} height={18} />
      </View>
    </View>
    <SkeletonBox width={40} height={40} borderRadius={20} />
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
    backgroundColor: appColors.surface,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
});
