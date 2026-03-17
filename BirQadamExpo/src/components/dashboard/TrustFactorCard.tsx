import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface TrustFactorCardProps {
  trustFactor: number;
  averageRating: number;
  projectsCount: number;
  onInfoPress: () => void;
  onStatsPress: () => void;
  scaleAnimation?: Animated.AnimatedValue;
  onLayout?: (event: any) => void;
  innerRef?: React.RefObject<View | null>;
}

export const TrustFactorCard: React.FC<TrustFactorCardProps> = React.memo(({
  trustFactor,
  averageRating,
  projectsCount,
  onInfoPress,
  onStatsPress,
  scaleAnimation,
  onLayout,
  innerRef,
}) => {
  return (
    <View
      ref={innerRef}
      onLayout={onLayout}
    >
      <Animated.View
        style={[
          styles.trustFactorCard,
          scaleAnimation ? { transform: [{ scale: scaleAnimation }] } : undefined,
        ]}
      >
        <View style={styles.trustFactorHeader}>
          <View>
            <View style={styles.levelBadge}>
              <Ionicons name="shield-checkmark" size={14} color="#FFFFFF" />
              <Text style={styles.levelBadgeText}>УРОВЕНЬ ВОЛОНТЁРА</Text>
            </View>
            <View style={styles.trustFactorRow}>
              <Ionicons name="flame" size={16} color="#FFFFFF" />
              <Text style={styles.trustFactorText}>
                <Text>Trust Factor: </Text>
                <Text style={styles.trustFactorNumber}>{trustFactor}</Text>
              </Text>
              <TouchableOpacity
                onPress={onInfoPress}
                style={styles.infoIconButton}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="information-circle-outline" size={18} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>
          <TouchableOpacity
            style={styles.viewStatsButton}
            onPress={onStatsPress}
          >
            <Text style={styles.viewStatsText}>Статистика</Text>
            <Ionicons name="chevron-forward" size={14} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
        
        <View style={styles.trustFactorBottom}>
          <View style={styles.ratingContainer}>
            <Text style={styles.ratingNumber}>{averageRating > 0 ? averageRating.toFixed(1) : '—'}</Text>
            <View style={styles.ratingStarsContainer}>
              <View style={styles.starsRow}>
                {[...Array(5)].map((_, i) => (
                  <Ionicons
                    key={i}
                    name="star"
                    size={12}
                    color={i < Math.round(averageRating) ? '#FCD34D' : 'rgba(255,255,255,0.3)'}
                  />
                ))}
              </View>
              <Text style={styles.ratingValue}>из 5.0</Text>
            </View>
          </View>
          <View style={styles.projectsBadge}>
            <Ionicons name="folder-open-outline" size={14} color="#FFFFFF" />
            <Text style={styles.projectsBadgeText}>
              <Text>Проектов: </Text>
              <Text style={styles.projectsBadgeNumber}>{projectsCount}</Text>
            </Text>
          </View>
        </View>
      </Animated.View>
    </View>
  );
});

TrustFactorCard.displayName = 'TrustFactorCard';

const styles = StyleSheet.create({
  trustFactorCard: {
    marginHorizontal: 20,
    marginTop: 16,
    backgroundColor: '#ACC8A2',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  trustFactorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  levelBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  levelBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  trustFactorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  trustFactorText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  trustFactorNumber: {
    fontSize: 16,
    fontWeight: '700',
  },
  infoIconButton: {
    marginLeft: 4,
  },
  viewStatsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  viewStatsText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  trustFactorBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  ratingNumber: {
    fontSize: 36,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  ratingStarsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  starsRow: {
    flexDirection: 'row',
    gap: 2,
  },
  ratingValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
    opacity: 0.9,
  },
  projectsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    gap: 6,
  },
  projectsBadgeText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  projectsBadgeNumber: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});

