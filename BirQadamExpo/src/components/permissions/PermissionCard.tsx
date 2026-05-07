import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { appColors } from '../../theme';
import { useTranslation } from "../../locales/i18n";

interface PermissionCardProps {
  type: 'notifications' | 'location' | 'network';
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  isGranted?: boolean;
}

export const PermissionCard: React.FC<PermissionCardProps> = ({
  type,
  title,
  description,
  icon,
  onPress,
  isGranted = false,
}) => {
    const { t } = useTranslation();
  const getCardStyle = () => {
    switch (type) {
      case 'notifications':
        return {
          gradient: ['#FF6B6B', '#EE5A5A'] as const,
          lightBg: 'rgba(255, 107, 107, 0.08)',
          iconColor: '#FF6B6B',
          borderColor: 'rgba(255, 107, 107, 0.2)',
        };
      case 'location':
        return {
          gradient: ['#4F46E5', '#6366F1'] as const,
          lightBg: 'rgba(79, 70, 229, 0.08)',
          iconColor: '#4F46E5',
          borderColor: 'rgba(79, 70, 229, 0.2)',
        };
      case 'network':
        return {
          gradient: [appColors.warning, '#FBBF24'] as const,
          lightBg: 'rgba(245, 158, 11, 0.08)',
          iconColor: appColors.warning,
          borderColor: 'rgba(245, 158, 11, 0.2)',
        };
      default:
        return {
          gradient: [appColors.textMuted, appColors.textSoft] as const,
          lightBg: 'rgba(107, 114, 128, 0.08)',
          iconColor: appColors.textMuted,
          borderColor: 'rgba(107, 114, 128, 0.2)',
        };
    }
  };

  const cardStyle = getCardStyle();

  if (isGranted) {
    return (
      <View style={[styles.card, styles.cardGranted]}>
        <View style={styles.cardContent}>
          <View style={[styles.iconContainerGranted, { backgroundColor: appColors.primarySurface }]}>
            <Ionicons name="checkmark-circle" size={36} color={appColors.primary} />
          </View>
          <View style={styles.textContainer}>
            <Text style={styles.titleGranted}>{title}</Text>
            <Text style={styles.descriptionGranted}>{t('permissioncard.s_0')}</Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: cardStyle.lightBg }]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <View style={styles.cardContent}>
        <LinearGradient
          colors={cardStyle.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.iconGradientContainer}
        >
          <Ionicons name={icon} size={28} color={appColors.white} />
        </LinearGradient>

        <View style={styles.textContainer}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.description} numberOfLines={2}>
            {description}
          </Text>
        </View>

        <View style={styles.actionContainer}>
          <View style={styles.actionButton}>
            <Text style={styles.actionText}>{t('permissioncard.s_1')}</Text>
            <Ionicons name="arrow-forward" size={18} color={appColors.white} />
          </View>
        </View>
      </View>

      <View style={[styles.statusBar, { backgroundColor: cardStyle.iconColor }]} />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 24,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 8,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  cardGranted: {
    backgroundColor: appColors.primarySurface,
    borderColor: 'rgba(16, 185, 129, 0.2)',
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
  },
  iconContainerGranted: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    shadowColor: appColors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 4,
  },
  iconGradientContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 6,
  },
  textContainer: {
    flex: 1,
    marginRight: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: appColors.text,
    marginBottom: 6,
    letterSpacing: -0.3,
  },
  titleGranted: {
    fontSize: 18,
    fontWeight: '700',
    color: '#065F46',
    marginBottom: 4,
    letterSpacing: -0.3,
  },
  description: {
    fontSize: 14,
    color: appColors.textMuted,
    lineHeight: 20,
    paddingRight: 8,
  },
  descriptionGranted: {
    fontSize: 14,
    color: appColors.primaryDark,
    lineHeight: 20,
  },
  actionContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: appColors.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  actionText: {
    fontSize: 13,
    fontWeight: '600',
    color: appColors.white,
  },
  statusBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
  },
});
