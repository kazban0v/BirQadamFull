import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { appColors } from '../../../theme';
import { SkeletonBox } from '../SkeletonBox';

export const SkeletonCalendar: React.FC = () => {
  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <View>
            <SkeletonBox width={80} height={14} style={{ marginBottom: 4 }} />
            <SkeletonBox width={140} height={24} />
          </View>
          <SkeletonBox width={36} height={36} borderRadius={18} />
        </View>

        <View style={styles.calendarCard}>
          <View style={styles.monthRow}>
            <SkeletonBox width={24} height={24} borderRadius={12} />
            <SkeletonBox width={120} height={20} />
            <SkeletonBox width={24} height={24} borderRadius={12} />
          </View>

          <View style={styles.weekdaysRow}>
            {[1, 2, 3, 4, 5, 6, 7].map((key) => (
              <View key={key} style={styles.weekdayBox}>
                <SkeletonBox width={20} height={14} />
              </View>
            ))}
          </View>

          <View style={styles.daysGrid}>
            {[...Array(35)].map((_, i) => (
              <View key={i} style={styles.dayCell}>
                <SkeletonBox width={28} height={28} borderRadius={14} />
              </View>
            ))}
          </View>
        </View>

        <View style={styles.eventsHeader}>
          <SkeletonBox width={150} height={20} />
        </View>

        <View style={styles.eventsList}>
          {[1, 2, 3].map((key) => (
            <View key={key} style={styles.eventCard}>
              <View style={styles.eventTimeCol}>
                <SkeletonBox width={40} height={14} style={{ marginBottom: 4 }} />
                <SkeletonBox width={30} height={12} />
              </View>
              <View style={styles.eventContentCol}>
                <SkeletonBox width={80} height={20} borderRadius={10} style={{ marginBottom: 8 }} />
                <SkeletonBox width="90%" height={16} style={{ marginBottom: 6 }} />
                <SkeletonBox width="60%" height={14} />
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: appColors.surfaceSoft,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  calendarCard: {
    backgroundColor: appColors.surface,
    borderRadius: 24,
    padding: 20,
    marginBottom: 24,
  },
  monthRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  weekdaysRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  weekdayBox: {
    flex: 1,
    alignItems: 'center',
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: '14.28%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  eventsHeader: {
    marginBottom: 16,
  },
  eventsList: {
    gap: 12,
  },
  eventCard: {
    flexDirection: 'row',
    backgroundColor: appColors.surface,
    borderRadius: 16,
    padding: 16,
  },
  eventTimeCol: {
    width: 64,
    alignItems: 'flex-start',
    paddingTop: 4,
  },
  eventContentCol: {
    flex: 1,
    paddingLeft: 12,
    borderLeftWidth: 1,
    borderColor: appColors.borderSoft,
  },
});
