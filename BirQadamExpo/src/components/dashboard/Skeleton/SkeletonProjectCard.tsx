import React from 'react';
import { View, StyleSheet } from 'react-native';
import { appColors } from '../../../theme';
import { SkeletonBox } from '../../skeleton/SkeletonBox';

export const SkeletonProjectCard: React.FC = () => (
  <View style={styles.projectCard}>
    <SkeletonBox width="100%" height={180} borderRadius={0} />
    <View style={styles.projectContent}>
      <SkeletonBox width="80%" height={20} style={{ marginBottom: 12 }} />
      <View style={{ flexDirection: 'row', marginBottom: 8 }}>
        <SkeletonBox width={100} height={16} style={{ marginRight: 12 }} />
        <SkeletonBox width={100} height={16} />
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 }}>
        <SkeletonBox width={100} height={14} />
        <SkeletonBox width={80} height={14} />
      </View>
      <SkeletonBox width="100%" height={40} borderRadius={8} />
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
