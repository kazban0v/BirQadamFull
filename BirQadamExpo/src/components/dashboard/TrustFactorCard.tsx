import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { appColors } from '../../theme';
import { useTranslation } from '../../locales/i18n';

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
  const { t } = useTranslation();
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
          <View style={styles.trustFactorHeaderMain}>
            <View style={styles.levelBadge}>
              <Ionicons name="shield-checkmark" size={14} color={appColors.white} />
              <Text style={styles.levelBadgeText}>{t('trustfactorcard.s_0')}</Text>
            </View>
            <View style={styles.trustFactorRow}>
              <Ionicons name="flame" size={16} color={appColors.white} />
              <Text style={styles.trustFactorText}>
                <Text>Trust Factor: </Text>
                <Text style={styles.trustFactorNumber}>{trustFactor}</Text>
                <Text style={styles.trustFactorMax}> / 30</Text>
              </Text>
              <TouchableOpacity
                onPress={onInfoPress}
                style={styles.infoIconButton}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="information-circle-outline" size={18} color={appColors.white} />
              </TouchableOpacity>
            </View>

            {/* Добавленный прогресс-бар */}
            <View style={styles.progressBarContainer}>
              <View style={[styles.progressBarFill, { width: `${Math.min((trustFactor / 30) * 100, 100)}%` }]} />
            </View>
          </View>
          <TouchableOpacity
            style={styles.viewStatsButton}
            onPress={onStatsPress}
          >
            <Text style={styles.viewStatsText}>{t('trustfactorcard.s_1')}</Text>
            <Ionicons name="chevron-forward" size={14} color={appColors.white} />
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
              <Text style={styles.ratingValue}>{t('trustfactorcard.s_2')}</Text>
            </View>
          </View>
          <View style={styles.projectsBadge}>
            <Ionicons name="folder-open-outline" size={14} color={appColors.white} />
            <Text style={styles.projectsBadgeText} numberOfLines={1} adjustsFontSizeToFit>
              <Text>{t('trustfactorcard.s_3')}</Text>
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
    backgroundColor: appColors.primary,
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
  trustFactorHeaderMain: {
    flex: 1,
    minWidth: 0,
    marginRight: 12,
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
    color: appColors.white,
    letterSpacing: 0.5,
  },
  trustFactorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  trustFactorText: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
    fontSize: 14,
    color: appColors.white,
    fontWeight: '500',
  },
  trustFactorNumber: {
    fontSize: 16,
    fontWeight: '700',
  },
  // Новые стили:
  trustFactorMax: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '500',
  },
  progressBarContainer: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.2)', // Полупрозрачный фон
    borderRadius: 3,
    marginTop: 8,
    width: '100%',
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: appColors.surface, // Белая полоса прогресса
    borderRadius: 3,
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
    color: appColors.white,
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
    color: appColors.white,
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
    color: appColors.white,
    opacity: 0.9,
  },
  projectsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10, // Чуть уменьшили отступы (было 12)
    paddingVertical: 6,    // Чуть уменьшили (было 8)
    borderRadius: 14,
    gap: 4,                // Чуть уменьшили расстояние до иконки (было 6)
    flexShrink: 1,         // ВАЖНО: Разрешаем плашке сжиматься, если не хватает места
    marginLeft: 10,        // Даем отступ от звезд рейтинга
  },
  projectsBadgeText: {
    fontSize: 11,          // Сделали шрифт капельку меньше (было 12)
    color: appColors.white,
    fontWeight: '600',
    flexShrink: 1,         // Разрешаем тексту сжиматься
  },
  projectsBadgeNumber: {
    fontSize: 14,
    fontWeight: '700',
    color: appColors.white,
  },
});

