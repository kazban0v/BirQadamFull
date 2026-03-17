import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Platform,
  Dimensions,
  StatusBar,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { usePermissions } from '../../hooks/usePermissions';
import { PermissionCard } from '../../components/permissions/PermissionCard';
import { LinearGradient } from 'expo-linear-gradient';

interface PermissionsStatusScreenProps {
  navigation?: any;
}

interface MissingPermission {
  type: 'notifications' | 'location' | 'network';
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
}

export const PermissionsStatusScreen: React.FC<PermissionsStatusScreenProps> = ({
  navigation,
}) => {
  const { permissions, isChecking, checkAllPermissions, openSettings, hasMissingPermissions } =
    usePermissions();

  const screenHeight = Dimensions.get('window').height;
  const [fadeAnim] = useState(new Animated.Value(0));
  const [scaleAnim] = useState(new Animated.Value(0.8));

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const missingPermissions: MissingPermission[] = [];

  if (!permissions.notifications.granted) {
    missingPermissions.push({
      type: 'notifications' as const,
      title: 'Уведомления',
      description:
        'Получайте уведомления о новых задачах, проектах и важных обновлениях',
      icon: 'notifications-outline' as keyof typeof Ionicons.glyphMap,
    });
  }

  if (!permissions.location.granted) {
    missingPermissions.push({
      type: 'location' as const,
      title: 'Геолокация',
      description:
        'Находите проекты рядом с вами и используйте карту для навигации',
      icon: 'location-outline' as keyof typeof Ionicons.glyphMap,
    });
  }

  if (!permissions.network.isConnected) {
    missingPermissions.push({
      type: 'network' as const,
      title: 'Интернет',
      description:
        'Проверьте подключение к Wi-Fi или мобильным данным',
      icon: 'wifi-outline' as keyof typeof Ionicons.glyphMap,
    });
  }

  const handlePermissionPress = (type: 'notifications' | 'location' | 'network') => {
    if (type === 'network') {
      checkAllPermissions();
    } else {
      openSettings();
    }
  };

  useEffect(() => {
    if (!hasMissingPermissions() && !isChecking && navigation) {
      const timer = setTimeout(() => {
        navigation.goBack();
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [hasMissingPermissions, isChecking, navigation]);

  if (!hasMissingPermissions() && !isChecking) {
    return (
      <LinearGradient
        colors={['#10B981', '#059669', '#047857']}
        style={styles.successContainer}
      >
        <StatusBar barStyle="light-content" backgroundColor="#10B981" />
        <Animated.View
          style={[
            styles.successContent,
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          <View style={styles.successIconWrapper}>
            <Ionicons name="checkmark-circle" size={120} color="#FFFFFF" />
          </View>
          <Text style={styles.successTitle}>Всё готово!</Text>
          <Text style={styles.successDescription}>
            Все разрешения предоставлены{'\n'}
            Приложение готово к работе
          </Text>
          <View style={styles.successLoader}>
            <View style={styles.successLoaderBar} />
          </View>
        </Animated.View>
      </LinearGradient>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1F2937" />

      <LinearGradient
        colors={['#1F2937', '#374151', '#4B5563']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.header}
      >
        {navigation && (
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={26} color="#FFFFFF" />
          </TouchableOpacity>
        )}
        <View style={styles.headerCenter}>
          <Ionicons name="shield-checkmark" size={32} color="#10B981" />
          <Text style={styles.headerTitle}>Разрешения</Text>
        </View>
        <View style={styles.backButton} />
      </LinearGradient>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isChecking}
            onRefresh={checkAllPermissions}
            tintColor="#10B981"
            colors={['#10B981']}
            progressBackgroundColor="#FFFFFF"
          />
        }
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <Animated.View style={[styles.contentContainer, { opacity: fadeAnim }]}>
          <View style={styles.iconSection}>
            <View style={styles.iconGlow}>
              <Ionicons name="shield-outline" size={80} color="#F59E0B" />
            </View>
          </View>

          <View style={styles.textSection}>
            <Text style={styles.mainTitle}>Требуются разрешения</Text>
            <Text style={styles.mainDescription}>
              Для полноценной работы приложения{'\n'}
              необходимо предоставить доступ
            </Text>
          </View>

          <View style={styles.cardsSection}>
            {missingPermissions.map((permission, index) => (
              <Animated.View
                key={permission.type}
                style={[
                  {
                    opacity: fadeAnim,
                    transform: [
                      {
                        translateY: scaleAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [20 * (index + 1), 0],
                        }),
                      },
                    ],
                  },
                ]}
              >
                <PermissionCard
                  type={permission.type}
                  title={permission.title}
                  description={permission.description}
                  icon={permission.icon}
                  onPress={() => handlePermissionPress(permission.type)}
                />
              </Animated.View>
            ))}
          </View>

          <View style={styles.infoSection}>
            <View style={styles.infoBox}>
              <View style={styles.infoIconContainer}>
                <Ionicons name="bulb-outline" size={24} color="#F59E0B" />
              </View>
              <Text style={styles.infoText}>
                Нажмите на карточку, чтобы открыть настройки и предоставить разрешения
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.checkButton, isChecking && styles.checkButtonDisabled]}
            onPress={checkAllPermissions}
            disabled={isChecking}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={isChecking ? ['#9CA3AF', '#6B7280'] : ['#10B981', '#059669']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.checkButtonGradient}
            >
              <Ionicons
                name={isChecking ? 'hourglass' : 'refresh'}
                size={22}
                color="#FFFFFF"
                style={isChecking && styles.rotatingIcon}
              />
              <Text style={styles.checkButtonText}>
                {isChecking ? 'Проверка...' : 'Проверить снова'}
              </Text>
            </LinearGradient>
          </TouchableOpacity>

          <View style={styles.footer}>
            <Text style={styles.footerText}>
              Безопасность ваших данных — наш приоритет
            </Text>
          </View>
        </Animated.View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 50 : StatusBar.currentHeight ? StatusBar.currentHeight + 10 : 20,
    paddingBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 12,
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  contentContainer: {
    flex: 1,
  },
  iconSection: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
    marginHorizontal: 20,
    marginTop: 20,
  },
  iconGlow: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'rgba(245, 158, 11, 0.2)',
    borderStyle: 'dashed',
  },
  textSection: {
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 24,
    alignItems: 'center',
  },
  mainTitle: {
    fontSize: 30,
    fontWeight: '800',
    color: '#1F2937',
    marginBottom: 12,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  mainDescription: {
    fontSize: 16,
    color: '#6B7280',
    lineHeight: 26,
    textAlign: 'center',
    fontWeight: '500',
  },
  cardsSection: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
  },
  infoSection: {
    paddingHorizontal: 20,
    marginTop: 8,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FEF3C7',
    padding: 18,
    borderRadius: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#F59E0B',
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
  },
  infoIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: '#92400E',
    lineHeight: 22,
    fontWeight: '500',
    paddingTop: 2,
  },
  checkButton: {
    marginHorizontal: 20,
    marginTop: 24,
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  checkButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    gap: 10,
  },
  checkButtonDisabled: {
    opacity: 0.7,
  },
  checkButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  rotatingIcon: {
    transform: [{ rotate: '360deg' }],
  },
  footer: {
    paddingHorizontal: 20,
    marginTop: 32,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 13,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  successContainer: {
    flex: 1,
  },
  successContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  successIconWrapper: {
    marginBottom: 32,
    alignItems: 'center',
  },
  successTitle: {
    fontSize: 36,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 16,
    textAlign: 'center',
    letterSpacing: -0.5,
    textShadowColor: 'rgba(0, 0, 0, 0.1)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  successDescription: {
    fontSize: 18,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    lineHeight: 28,
    fontWeight: '500',
  },
  successLoader: {
    width: 200,
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 2,
    marginTop: 40,
    overflow: 'hidden',
  },
  successLoaderBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: '60%',
    backgroundColor: '#FFFFFF',
    borderRadius: 2,
  },
});
