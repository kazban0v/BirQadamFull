import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { appColors } from '../../../theme';
import { SkeletonBox } from '../SkeletonBox';

export const SkeletonTasksList: React.FC = () => {
  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <SkeletonBox width={24} height={24} borderRadius={12} />
          <SkeletonBox width={120} height={24} style={{ marginLeft: 16 }} />
          <View style={{ flex: 1 }} />
          <SkeletonBox width={24} height={24} borderRadius={12} />
        </View>

        {/* Filter Tabs */}
        <View style={styles.filterScroll}>
          <View style={styles.filterContainer}>
            <SkeletonBox width={80} height={40} borderRadius={20} style={{ marginRight: 8 }} />
            <SkeletonBox width={100} height={40} borderRadius={20} style={{ marginRight: 8 }} />
            <SkeletonBox width={110} height={40} borderRadius={20} style={{ marginRight: 8 }} />
            <SkeletonBox width={90} height={40} borderRadius={20} />
          </View>
        </View>

        {/* List of Tasks */}
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {[1, 2, 3, 4, 5].map((key) => (
            <View key={key} style={styles.taskCard}>
              <View style={styles.cardTopRow}>
                <SkeletonBox width={84} height={84} borderRadius={12} />
                <View style={styles.taskContentRight}>
                  <View style={styles.taskHeader}>
                    <SkeletonBox width="50%" height={16} />
                    <SkeletonBox width={60} height={20} borderRadius={8} />
                  </View>
                  <SkeletonBox width="80%" height={20} style={{ marginBottom: 6 }} />
                  <SkeletonBox width="60%" height={20} style={{ marginBottom: 12 }} />
                  
                  <View style={styles.deadlineColumn}>
                    <SkeletonBox width="40%" height={14} style={{ marginBottom: 6 }} />
                    <SkeletonBox width="50%" height={14} />
                  </View>
                </View>
              </View>
            </View>
          ))}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: appColors.surfaceSoft,
  },
  container: {
    flex: 1,
    backgroundColor: appColors.surfaceSoft,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: appColors.surfaceSoft,
  },
  filterScroll: {
    paddingVertical: 6,
    paddingBottom: 12,
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 12,
  },
  taskCard: {
    backgroundColor: appColors.surface,
    padding: 14,
    borderRadius: 16,
    marginBottom: 2,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  taskContentRight: {
    flex: 1,
    marginLeft: 16,
    justifyContent: 'center',
  },
  taskHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  deadlineColumn: {
    marginTop: 4,
  },
});
