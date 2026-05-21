import React, { useEffect, useRef } from 'react';
import {
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { appColors } from '../theme';

// ─── Types ────────────────────────────────────────────────────────────────────

export type EmptyStateSize    = 'sm' | 'md' | 'lg';
export type EmptyStateVariant = 'default' | 'card';

export interface EmptyStateAction {
  label: string;
  onPress: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
}

export interface EmptyStateProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description?: string;
  action?: EmptyStateAction;
  size?: EmptyStateSize;
  variant?: EmptyStateVariant;
}

// ─── Config ───────────────────────────────────────────────────────────────────

const SIZE_CONFIG: Record<EmptyStateSize, {
  iconSize: number;
  circleSize: number;
  showCircle: boolean;
  titleSize: number;
  padding: number;
}> = {
  sm: { iconSize: 36, circleSize: 0,   showCircle: false, titleSize: 15, padding: 40 },
  md: { iconSize: 56, circleSize: 88,  showCircle: true,  titleSize: 18, padding: 56 },
  lg: { iconSize: 72, circleSize: 120, showCircle: true,  titleSize: 20, padding: 80 },
};

// ─── Component ────────────────────────────────────────────────────────────────

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  size = 'md',
  variant = 'default',
}) => {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(12)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 350, useNativeDriver: true }),
      Animated.spring(translateY, { toValue: 0, tension: 60, friction: 12, useNativeDriver: true }),
    ]).start();
  }, [opacity, translateY]);

  const cfg = SIZE_CONFIG[size];

  return (
    <Animated.View
      style={[
        styles.container,
        variant === 'card' && styles.card,
        { paddingVertical: cfg.padding, opacity, transform: [{ translateY }] },
      ]}
    >
      {cfg.showCircle ? (
        <View
          style={[
            styles.circle,
            { width: cfg.circleSize, height: cfg.circleSize, borderRadius: cfg.circleSize / 2 },
          ]}
        >
          <Ionicons name={icon} size={cfg.iconSize} color={appColors.primary} />
        </View>
      ) : (
        <Ionicons name={icon} size={cfg.iconSize} color={appColors.textSoft} style={styles.plainIcon} />
      )}

      <Text style={[styles.title, { fontSize: cfg.titleSize }]}>{title}</Text>

      {description ? (
        <Text style={styles.description}>{description}</Text>
      ) : null}

      {action ? (
        <TouchableOpacity style={styles.button} onPress={action.onPress} activeOpacity={0.82}>
          {action.icon ? (
            <Ionicons name={action.icon} size={18} color={appColors.white} />
          ) : null}
          <Text style={styles.buttonText}>{action.label}</Text>
        </TouchableOpacity>
      ) : null}
    </Animated.View>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  card: {
    backgroundColor: appColors.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: appColors.border,
    marginHorizontal: 0,
  },
  circle: {
    backgroundColor: appColors.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  plainIcon: {
    marginBottom: 16,
  },
  title: {
    fontWeight: '700',
    color: appColors.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    color: appColors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: appColors.primary,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 16,
    marginTop: 8,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '700',
    color: appColors.white,
  },
});
