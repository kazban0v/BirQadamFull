import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { appColors } from '../../theme';
import { appRadius, appSpace } from '../../theme/tokens';
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
  const isRisk = trustFactor <= 0;
  const pulseOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!isRisk) {
      pulseOpacity.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseOpacity, {
          toValue: 0.86,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseOpacity, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [isRisk, pulseOpacity]);

  const cardBg = isRisk ? appColors.danger : appColors.primary;
  const progressPct = Math.min(((trustFactor <= 0 ? 0 : trustFactor) / 30) * 100, 100);

  return (
    <View ref={innerRef} onLayout={onLayout}>
      <Animated.View
        style={[
          styles.trustFactorCard,
          {
            backgroundColor: cardBg,
            borderRadius: appRadius.xl,
            padding: appSpace.lg,
            opacity: isRisk ? pulseOpacity : 1,
          },
          scaleAnimation ? { transform: [{ scale: scaleAnimation }] } : undefined,
        ]}
      >
        <View style={styles.trustFactorHeader}>
          <View style={styles.trustFactorHeaderMain}>
            <View style={styles.levelBadge}>
              <Ionicons
                name={isRisk ? 'alert-circle' : 'shield-checkmark'}
                size={14}
                color={appColors.white}
              />
              <Text style={styles.levelBadgeText}>
                {isRisk ? t('trustfactorcard.s_4') : t('trustfactorcard.s_0')}
              </Text>
            </View>
            <View style={styles.trustFactorRow}>
              <Ionicons name={isRisk ? 'warning' : 'flame'} size={16} color={appColors.white} />
              <Text style={styles.trustFactorText}>
                <Text>Trust Factor: </Text>
                <Text style={styles.trustFactorNumber}>{trustFactor}</Text>
                <Text style={styles.trustFactorMax}> / 30</Text>
              </Text>
              <TouchableOpacity
                onPress={onInfoPress}
                style={styles.infoIconButton}
                accessibilityRole="button"
                accessibilityLabel={t('trustfactorcard.s_5')}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <Ionicons name="information-circle-outline" size={18} color={appColors.white} />
              </TouchableOpacity>
            </View>

            <View style={styles.progressBarContainer}>
              <View style={[styles.progressBarFill, { width: `${progressPct}%` }]} />
            </View>
          </View>
          <TouchableOpacity
            style={styles.viewStatsButton}
            onPress={onStatsPress}
            accessibilityRole="button"
            accessibilityLabel={t('trustfactorcard.s_1')}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.viewStatsText}>{t('trustfactorcard.s_1')}</Text>
            <Ionicons name="chevron-forward" size={14} color={appColors.white} />
          </TouchableOpacity>
        </View>

        <View style={styles.trustFactorBottom}>
          <View style={styles.ratingContainer}>
            <Text style={[styles.ratingNumber, isRisk && styles.ratingNumberMuted]}>
              {averageRating > 0 ? averageRating.toFixed(1) : '—'}
            </Text>
            <View style={styles.ratingStarsContainer}>
              <View style={styles.starsRow}>
                {[...Array(5)].map((_, i) => (
                  <Ionicons
                    key={i}
                    name="star"
                    size={11}
                    color={
                      i < Math.round(averageRating)
                        ? appColors.warning
                        : 'rgba(255,255,255,0.28)'
                    }
                  />
                ))}
              </View>
              <Text style={[styles.ratingValue, isRisk && styles.ratingMetaMuted]}>{t('trustfactorcard.s_2')}</Text>
            </View>
          </View>
          <View style={[styles.projectsBadge, isRisk && styles.projectsBadgeRisk]}>
            <Ionicons name="folder-open-outline" size={14} color={appColors.white} />
            <Text style={styles.projectsBadgeText} numberOfLines={1} adjustsFontSizeToFit>
              <Text>{t('trustfactorcard.s_3')}</Text>
              <Text style={styles.projectsBadgeNumber}>{projectsCount}</Text>
            </Text>
          </View>
        </View>
      </Animated.View>
      {isRisk ? (
        <Text style={styles.riskFootnote}>{t('trustfactorcard.s_6')}</Text>
      ) : null}
    </View>
  );
});

TrustFactorCard.displayName = 'TrustFactorCard';

const styles = StyleSheet.create({
  trustFactorCard: {
    marginHorizontal: 20,
    marginTop: 16,
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
    backgroundColor: 'rgba(255,255,255,0.22)',
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
  trustFactorMax: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.75)',
    fontWeight: '500',
  },
  progressBarContainer: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderRadius: 3,
    marginTop: 8,
    width: '100%',
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: appColors.surface,
    borderRadius: 3,
  },
  infoIconButton: {
    marginLeft: 4,
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewStatsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.22)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 40,
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
  ratingNumberMuted: {
    opacity: 0.9,
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
    fontSize: 11,
    fontWeight: '600',
    color: appColors.white,
    opacity: 0.92,
  },
  ratingMetaMuted: {
    opacity: 0.85,
  },
  projectsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.22)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    gap: 4,
    flexShrink: 1,
    marginLeft: 10,
  },
  projectsBadgeRisk: {
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  projectsBadgeText: {
    fontSize: 11,
    color: appColors.white,
    fontWeight: '600',
    flexShrink: 1,
  },
  projectsBadgeNumber: {
    fontSize: 14,
    fontWeight: '700',
    color: appColors.white,
  },
  riskFootnote: {
    marginHorizontal: 24,
    marginTop: 8,
    fontSize: 12,
    lineHeight: 17,
    color: appColors.danger,
    fontWeight: '600',
  },
});
