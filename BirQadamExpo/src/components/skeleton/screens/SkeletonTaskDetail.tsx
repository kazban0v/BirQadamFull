import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { appColors } from '../../../theme';
import { SkeletonBox } from '../SkeletonBox';

export const SkeletonTaskDetail: React.FC = () => {
  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.appBar}>
        <SkeletonBox width={24} height={24} borderRadius={12} />
        <SkeletonBox width={160} height={20} />
        <View style={{ width: 40 }} />
      </SafeAreaView>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Cover Image */}
        <View style={styles.imageContainer}>
          <SkeletonBox width="100%" height={200} borderRadius={16} />
        </View>

        <View style={styles.body}>
          {/* Title */}
          <SkeletonBox width="85%" height={26} style={{ marginBottom: 8 }} />
          <SkeletonBox width="60%" height={26} style={{ marginBottom: 16 }} />

          {/* Description */}
          <SkeletonBox width="100%" height={16} style={{ marginBottom: 6 }} />
          <SkeletonBox width="100%" height={16} style={{ marginBottom: 6 }} />
          <SkeletonBox width="80%" height={16} style={{ marginBottom: 24 }} />

          {/* Deadline Card */}
          <View style={styles.deadlineCard}>
            <View style={styles.deadlineTopRow}>
              <SkeletonBox width={100} height={16} />
              <SkeletonBox width={60} height={20} borderRadius={10} />
            </View>
            <View style={styles.deadlineBottomRow}>
              <View>
                <SkeletonBox width={140} height={20} style={{ marginBottom: 6 }} />
                <SkeletonBox width={90} height={14} />
              </View>
              <View style={{ alignItems: 'flex-end', flex: 1 }}>
                <SkeletonBox width={70} height={12} style={{ marginBottom: 6 }} />
                <SkeletonBox width={50} height={16} />
              </View>
            </View>
          </View>

          {/* Location Info */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
            <SkeletonBox width={20} height={20} borderRadius={10} style={{ marginRight: 12 }} />
            <SkeletonBox width="70%" height={16} />
          </View>

          {/* Organizer */}
          <View style={styles.organizerRow}>
            <SkeletonBox width={44} height={44} borderRadius={22} style={styles.organizerAvatar} />
            <View style={styles.organizerInfo}>
              <SkeletonBox width={80} height={12} style={{ marginBottom: 4 }} />
              <SkeletonBox width={130} height={16} />
            </View>
            <SkeletonBox width={36} height={36} borderRadius={18} />
          </View>

          <View style={styles.divider} />

          {/* Timeline */}
          <SkeletonBox width={150} height={20} style={{ marginBottom: 20 }} />
          
          <View style={styles.timeline}>
            {[1, 2, 3].map((key, index) => (
              <View key={key} style={{ flexDirection: 'row', marginBottom: index === 2 ? 0 : 24 }}>
                <View style={{ alignItems: 'center', marginRight: 16 }}>
                  <SkeletonBox width={26} height={26} borderRadius={13} />
                  {index !== 2 && <SkeletonBox width={2} height={40} style={{ marginTop: 8 }} />}
                </View>
                <View style={{ flex: 1, paddingTop: 4 }}>
                  <SkeletonBox width={120} height={16} style={{ marginBottom: 8 }} />
                  <SkeletonBox width={160} height={12} />
                </View>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: appColors.surface,
  },
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: appColors.surface,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  imageContainer: {
    paddingHorizontal: 16,
    marginTop: 8,
  },
  body: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  deadlineCard: {
    backgroundColor: appColors.surfaceSoft,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: appColors.borderSoft,
    marginBottom: 24,
  },
  deadlineTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  deadlineBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  organizerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  organizerAvatar: {
    marginRight: 12,
  },
  organizerInfo: {
    flex: 1,
  },
  divider: {
    height: 1,
    backgroundColor: appColors.borderSoft,
    marginBottom: 24,
  },
  timeline: {
    marginTop: 8,
  },
});
