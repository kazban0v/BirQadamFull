import React, { useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { appColors } from '../../theme';
import { useTranslation } from "../../locales/i18n";

export type NextBestActionCardData = {
  id: string;
  eyebrow?: string;
  badge: string;
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  accentColor: string;
  accentSurface: string;
  ctaLabel: string;
  ctaIcon?: keyof typeof Ionicons.glyphMap;
  highlights?: string[];
  secondaryLabel?: string;
  loadingText?: string;
  onPress: () => void;
  onSecondaryPress?: () => void;
};

interface NextBestActionCardProps {
  action: NextBestActionCardData;
  loading?: boolean;
}

export const NextBestActionCard: React.FC<NextBestActionCardProps> = ({
  action,
  loading = false,
}) => {
    const { t } = useTranslation();
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const cardTranslateY = useRef(new Animated.Value(18)).current;
  const iconScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    cardOpacity.setValue(0);
    cardTranslateY.setValue(18);
    iconScale.setValue(1);

    const entrance = Animated.parallel([
      Animated.timing(cardOpacity, {
        toValue: 1,
        duration: 280,
        useNativeDriver: true,
      }),
      Animated.spring(cardTranslateY, {
        toValue: 0,
        damping: 16,
        stiffness: 170,
        mass: 0.9,
        useNativeDriver: true,
      }),
    ]);

    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(iconScale, {
          toValue: 1.06,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.timing(iconScale, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true,
        }),
      ])
    );

    entrance.start(() => {
      if (!loading) {
        pulse.start();
      }
    });

    return () => {
      pulse.stop();
    };
  }, [action.id, cardOpacity, cardTranslateY, iconScale, loading]);

  return (
    <Animated.View
      style={[
        styles.card,
        {
          opacity: cardOpacity,
          transform: [{ translateY: cardTranslateY }],
        },
      ]}
    >
      <View style={styles.headerRow}>
        <View style={styles.eyebrowWrap}>
          <Text style={styles.eyebrow}>{action.eyebrow || t('nextbestactioncard.s_0')}</Text>
          <View style={[styles.badge, { backgroundColor: action.accentSurface }]}>
            <Text style={[styles.badgeText, { color: action.accentColor }]}>{action.badge}</Text>
          </View>
        </View>

        <Animated.View
          style={[
            styles.iconWrap,
            {
              backgroundColor: action.accentSurface,
              transform: [{ scale: iconScale }],
            },
          ]}
        >
          <Ionicons name={action.icon} size={22} color={action.accentColor} />
        </Animated.View>
      </View>

      {loading ? (
        <View style={styles.loadingState}>
          <ActivityIndicator size="small" color={action.accentColor} />
          <Text style={styles.loadingText}>{action.loadingText || t('nextbestactioncard.s_1')}</Text>
        </View>
      ) : (
        <>
          <Text style={styles.title}>{action.title}</Text>
          <Text style={styles.description}>{action.description}</Text>

          {action.highlights?.length ? (
            <View style={styles.highlightsRow}>
              {action.highlights.map((item) => (
                <View key={item} style={styles.highlightChip}>
                  <Ionicons name="sparkles-outline" size={14} color={action.accentColor} />
                  <Text style={styles.highlightText}>{item}</Text>
                </View>
              ))}
            </View>
          ) : null}

          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={[styles.primaryButton, { backgroundColor: action.accentColor }]}
              activeOpacity={0.9}
              onPress={action.onPress}
            >
              <Text style={styles.primaryButtonText}>{action.ctaLabel}</Text>
              <Ionicons
                name={action.ctaIcon || 'arrow-forward'}
                size={18}
                color={appColors.white}
              />
            </TouchableOpacity>

            {action.secondaryLabel && action.onSecondaryPress ? (
              <TouchableOpacity
                style={styles.secondaryButton}
                activeOpacity={0.85}
                onPress={action.onSecondaryPress}
              >
                <Text style={styles.secondaryButtonText}>{action.secondaryLabel}</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </>
      )}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: appColors.surface,
    borderRadius: 28,
    padding: 22,
    borderWidth: 1,
    borderColor: appColors.border,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.06,
    shadowRadius: 18,
    elevation: 4,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  eyebrowWrap: {
    flex: 1,
    paddingRight: 12,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '800',
    color: appColors.textSoft,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  badge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '800',
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
    color: appColors.text,
    lineHeight: 28,
    marginBottom: 8,
  },
  description: {
    fontSize: 15,
    lineHeight: 22,
    color: appColors.textSecondary,
    marginBottom: 16,
  },
  highlightsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 18,
  },
  highlightChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: appColors.surfaceSoft,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: appColors.borderSoft,
  },
  highlightText: {
    marginLeft: 6,
    fontSize: 13,
    fontWeight: '700',
    color: appColors.textSecondary,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    minHeight: 60,
    borderRadius: 18,
    paddingVertical: 15,
    paddingHorizontal: 18,
  },
  primaryButtonText: {
    flexShrink: 1,
    fontSize: 15,
    fontWeight: '800',
    color: appColors.white,
    marginRight: 8,
    textAlign: 'center',
  },
  secondaryButton: {
    flex: 1,
    marginLeft: 10,
    minHeight: 60,
    paddingHorizontal: 18,
    paddingVertical: 15,
    borderRadius: 18,
    backgroundColor: appColors.surfaceSoft,
    borderWidth: 1,
    borderColor: appColors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: appColors.textSecondary,
    textAlign: 'center',
  },
  loadingState: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  loadingText: {
    marginLeft: 12,
    fontSize: 14,
    fontWeight: '600',
    color: appColors.textSecondary,
  },
});
