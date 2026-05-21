import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { appColors } from '../../../theme';
import { SkeletonBox } from '../SkeletonBox';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = (SCREEN_WIDTH - 48) / 2;

interface SkeletonProjectsProps {
  /** 'all' — экран Проекты (2 строки фильтров), 'my' — Мои проекты (1 строка) */
  mode?: 'all' | 'my';
  /** Сколько карточек показать */
  cardCount?: number;
  /** Вид списка */
  viewMode?: 'grid' | 'list';
}

export const SkeletonProjects: React.FC<SkeletonProjectsProps> = ({
  mode = 'all',
  cardCount = 4,
  viewMode = 'grid',
}) => {
  return (
    <View style={styles.container}>
      {/* Header: title + view toggle */}
      <View style={styles.header}>
        <SkeletonBox width={180} height={28} borderRadius={8} />
        <SkeletonBox width={84} height={36} borderRadius={10} />
      </View>

      {/* Search bar */}
      <View style={styles.searchWrap}>
        <SkeletonBox width="100%" height={44} borderRadius={12} />
      </View>

      {/* Filter row 1 (chips) */}
      <View style={styles.filterRow}>
        <SkeletonBox width={64} height={32} borderRadius={16} style={styles.chipGap} />
        <SkeletonBox width={92} height={32} borderRadius={16} style={styles.chipGap} />
        <SkeletonBox width={108} height={32} borderRadius={16} />
      </View>

      {/* Filter row 2 — только для "all" режима */}
      {mode === 'all' && (
        <View style={styles.filterRow}>
          <SkeletonBox width={96} height={32} borderRadius={16} style={styles.chipGap} />
          <SkeletonBox width={108} height={32} borderRadius={16} style={styles.chipGap} />
          <SkeletonBox width={120} height={32} borderRadius={16} style={styles.chipGap} />
          <SkeletonBox width={100} height={32} borderRadius={16} />
        </View>
      )}

      {/* Result count placeholder */}
      <View style={styles.resultRow}>
        <SkeletonBox width={80} height={14} borderRadius={6} />
      </View>

      {/* Cards */}
      {viewMode === 'grid' ? (
        <View style={styles.gridContent}>
          {Array.from({ length: cardCount }).map((_, i) => (
            <View
              key={i}
              style={[
                styles.gridCard,
                i % 2 === 0 ? { marginRight: 8 } : { marginLeft: 8 },
              ]}
            >
              <SkeletonBox width="100%" height={118} borderRadius={0} />
              <View style={styles.gridBody}>
                <SkeletonBox width="85%" height={14} style={{ marginBottom: 6 }} />
                <SkeletonBox width="60%" height={12} style={{ marginBottom: 8 }} />
                <View style={styles.statsRow}>
                  <SkeletonBox width={36} height={10} borderRadius={4} />
                  <SkeletonBox width={36} height={10} borderRadius={4} />
                </View>
                <SkeletonBox width="100%" height={36} borderRadius={10} style={{ marginTop: 10 }} />
              </View>
            </View>
          ))}
        </View>
      ) : (
        <View style={styles.listContent}>
          {Array.from({ length: cardCount }).map((_, i) => (
            <View key={i} style={styles.listCard}>
              <SkeletonBox width={92} height={92} borderRadius={0} />
              <View style={styles.listBody}>
                <SkeletonBox width={86} height={18} borderRadius={9} style={{ marginBottom: 6 }} />
                <SkeletonBox width="80%" height={14} style={{ marginBottom: 6 }} />
                <SkeletonBox width="55%" height={12} style={{ marginBottom: 8 }} />
                <View style={styles.statsRow}>
                  <SkeletonBox width={70} height={11} borderRadius={4} />
                  <SkeletonBox width={70} height={11} borderRadius={4} />
                </View>
              </View>
              <SkeletonBox width={48} height={48} borderRadius={12} style={{ marginRight: 10 }} />
            </View>
          ))}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: appColors.surfaceSoft,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 8,
  },
  searchWrap: {
    paddingHorizontal: 16,
    paddingBottom: 6,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    height: 44,
    gap: 6,
  },
  chipGap: {
    marginRight: 0,
  },
  resultRow: {
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 4,
  },

  // Grid
  gridContent: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  gridCard: {
    width: CARD_WIDTH,
    backgroundColor: appColors.surface,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 12,
  },
  gridBody: {
    padding: 10,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
  },

  // List
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  listCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: appColors.surface,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 10,
  },
  listBody: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
});
