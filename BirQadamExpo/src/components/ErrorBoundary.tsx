import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { appColors, appRadius, appSpace, appTypography } from '../theme';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  children: React.ReactNode;
  /** Показывать детали ошибки (только в dev-режиме) */
  showDetails?: boolean;
  /** Кастомный экран вместо дефолтного */
  fallback?: React.ReactNode;
  /** Колбэк при поимке ошибки (для логирования в Sentry и т.п.) */
  onError?: (error: Error, info: React.ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

// ─── ErrorBoundary class ──────────────────────────────────────────────────────

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary] Поймана ошибка рендеринга:', error, info);
    this.props.onError?.(error, info);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    // Кастомный fallback-экран от родителя
    if (this.props.fallback) {
      return this.props.fallback;
    }

    const isDev = __DEV__;
    const errorMessage = this.state.error?.message || 'Неизвестная ошибка';

    return (
      <View style={styles.container}>
        <View style={styles.card}>
          {/* Иконка */}
          <View style={styles.iconWrap}>
            <Ionicons name="warning-outline" size={48} color={appColors.danger} />
          </View>

          {/* Заголовок */}
          <Text style={styles.title}>Что-то пошло не так</Text>
          <Text style={styles.subtitle}>
            Произошла непредвиденная ошибка. Попробуйте перезапустить этот экран.
          </Text>

          {/* Детали ошибки — только в dev */}
          {isDev && this.props.showDetails !== false && (
            <ScrollView style={styles.detailsBox} nestedScrollEnabled>
              <Text style={styles.detailsText}>{errorMessage}</Text>
            </ScrollView>
          )}

          {/* Кнопка повторить */}
          <TouchableOpacity style={styles.button} onPress={this.handleRetry}>
            <Ionicons name="refresh-outline" size={18} color={appColors.white} style={styles.btnIcon} />
            <Text style={styles.buttonText}>Попробовать снова</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: appColors.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: appSpace.xl,
  },
  card: {
    backgroundColor: appColors.surfaceElevated,
    borderRadius: appRadius.xl,
    padding: appSpace.xl,
    width: '100%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  iconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(239,68,68,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: appSpace.lg,
  },
  title: {
    ...appTypography.sectionTitle,
    color: appColors.text,
    textAlign: 'center',
    marginBottom: appSpace.sm,
  },
  subtitle: {
    ...appTypography.body,
    color: appColors.textSecondary,
    textAlign: 'center',
    marginBottom: appSpace.lg,
    lineHeight: 22,
  },
  detailsBox: {
    backgroundColor: appColors.backgroundElevated,
    borderRadius: appRadius.md,
    padding: appSpace.md,
    width: '100%',
    maxHeight: 120,
    marginBottom: appSpace.lg,
  },
  detailsText: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: appColors.danger,
    lineHeight: 18,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: appColors.primary,
    borderRadius: appRadius.md,
    paddingVertical: appSpace.md,
    paddingHorizontal: appSpace.xl,
  },
  btnIcon: {
    marginRight: appSpace.sm,
  },
  buttonText: {
    ...appTypography.bodyStrong,
    color: appColors.white,
  },
});
