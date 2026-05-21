import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { appColors } from '../../theme';
import type { NextBestActionCardData } from './NextBestActionCard';
import { useTranslation } from "../../locales/i18n";

interface ProfileInsightDeckProps {
  actions: NextBestActionCardData[];
  loading?: boolean;
}

export const ProfileInsightDeck: React.FC<ProfileInsightDeckProps> = ({
  actions,
  loading = false,
}) => {
  const { t } = useTranslation();
  const defaultLoadingText = t('profileinsightdeck.s_0');
  const [activeId, setActiveId] = useState(actions[0]?.id ?? '');

  useEffect(() => {
    if (!actions.length) {
      setActiveId('');
      return;
    }

    setActiveId((currentId) =>
      actions.some((action) => action.id === currentId) ? currentId : actions[0].id
    );
  }, [actions]);

  const activeAction = useMemo(
    () => actions.find((action) => action.id === activeId) ?? actions[0],
    [actions, activeId]
  );

  if (!activeAction) {
    return null;
  }

  return (
    <View style={styles.card}>
      <View style={styles.segmentedWrap}>
        {actions.map((action) => {
          const isActive = action.id === activeAction.id;

          return (
            <TouchableOpacity
              key={action.id}
              activeOpacity={0.9}
              style={[
                styles.segmentButton,
                isActive && {
                  backgroundColor: action.accentColor,
                  borderColor: action.accentColor,
                },
              ]}
              onPress={() => setActiveId(action.id)}
            >
              <Text
                style={[
                  styles.segmentText,
                  isActive && styles.segmentTextActive,
                ]}
                numberOfLines={1}
              >
                {action.eyebrow || t('profileinsightdeck.s_1')}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.headerRow}>
        <View style={styles.eyebrowWrap}>
          <Text style={styles.eyebrow}>{activeAction.eyebrow || t('profileinsightdeck.s_2')}</Text>
          <View style={[styles.badge, { backgroundColor: activeAction.accentSurface }]}>
            <Text style={[styles.badgeText, { color: activeAction.accentColor }]}>
              {activeAction.badge}
            </Text>
          </View>
        </View>

        <View
          style={[
            styles.iconWrap,
            { backgroundColor: activeAction.accentSurface },
          ]}
        >
          <Ionicons name={activeAction.icon} size={22} color={activeAction.accentColor} />
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingState}>
          <ActivityIndicator size="small" color={activeAction.accentColor} />
          <Text style={styles.loadingText}>
            {activeAction.loadingText || defaultLoadingText}
          </Text>
        </View>
      ) : (
        <>
          <Text style={styles.title}>{activeAction.title}</Text>
          <Text style={styles.description}>{activeAction.description}</Text>

          {activeAction.highlights?.length ? (
            <View style={styles.highlightsRow}>
              {activeAction.highlights.map((item) => (
                <View key={item} style={styles.highlightChip}>
                  <Ionicons
                    name="sparkles-outline"
                    size={14}
                    color={activeAction.accentColor}
                  />
                  <Text style={styles.highlightText} numberOfLines={2}>
                    {item}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}

          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={[
                styles.primaryButton,
                { backgroundColor: activeAction.accentColor },
              ]}
              activeOpacity={0.9}
              onPress={activeAction.onPress}
            >
              <Text style={styles.primaryButtonText} numberOfLines={1}>{activeAction.ctaLabel}</Text>
              <Ionicons
                name={activeAction.ctaIcon || 'arrow-forward'}
                size={16}
                color={appColors.white}
                style={{ flexShrink: 0 }}
              />
            </TouchableOpacity>

            {activeAction.secondaryLabel && activeAction.onSecondaryPress ? (
              <TouchableOpacity
                style={styles.secondaryButton}
                activeOpacity={0.85}
                onPress={activeAction.onSecondaryPress}
              >
                <Text style={styles.secondaryButtonText}>{activeAction.secondaryLabel}</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </>
      )}
    </View>
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
  segmentedWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 18,
    marginHorizontal: -4,
  },
  segmentButton: {
    minHeight: 38,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 9,
    marginHorizontal: 4,
    marginBottom: 8,
    backgroundColor: appColors.surfaceSoft,
    borderWidth: 1,
    borderColor: appColors.borderSoft,
  },
  segmentText: {
    fontSize: 12,
    fontWeight: '800',
    color: appColors.textSecondary,
  },
  segmentTextActive: {
    color: appColors.white,
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
    maxWidth: '100%',
  },
  highlightText: {
    marginLeft: 6,
    fontSize: 13,
    fontWeight: '700',
    color: appColors.textSecondary,
    flexShrink: 1,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 3,
    minHeight: 56,
    borderRadius: 18,
    paddingVertical: 13,
    paddingHorizontal: 16,
  },
  primaryButtonText: {
    flexShrink: 1,
    fontSize: 14,
    fontWeight: '800',
    color: appColors.white,
    marginRight: 6,
    textAlign: 'center',
  },
  secondaryButton: {
    flex: 2,
    marginLeft: 8,
    minHeight: 56,
    paddingHorizontal: 12,
    paddingVertical: 13,
    borderRadius: 18,
    backgroundColor: appColors.surfaceSoft,
    borderWidth: 1,
    borderColor: appColors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    fontSize: 13,
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
    flex: 1,
  },
});
