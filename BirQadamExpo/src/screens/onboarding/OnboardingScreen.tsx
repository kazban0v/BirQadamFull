import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Image,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../../components/Button';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { useTranslation } from '../../locales/i18n';
import { OnboardingStorage } from '../../utils/storage';

const { width, height } = Dimensions.get('window');

// Импортируем изображения
const onboarding1 = require('../../../assets/images/onboarding1.png');
const almatyMap = require('../../../assets/images/almaty-map.png');
const onboarding3 = require('../../../assets/images/onboarding3.png');
const onboarding4 = require('../../../assets/images/onboarding4.png');

interface OnboardingScreenProps {
  onComplete: () => void;
}

interface OnboardingPage {
  id: number;
  type?: 'content' | 'location' | 'notifications';
  icon: keyof typeof Ionicons.glyphMap;
  titleKey: string;
  descriptionKey: string;
  image?: any;
  color?: string;
}

const onboardingPages: OnboardingPage[] = [
  {
    id: 1,
    type: 'content',
    icon: 'people',
    titleKey: 'onboarding.page1.title',
    descriptionKey: 'onboarding.page1.description',
    color: '#10B981',
    image: onboarding1,
  },
  {
    id: 2,
    type: 'location',
    icon: 'location',
    titleKey: 'onboarding.page2.title',
    descriptionKey: 'onboarding.page2.description',
    color: '#3B82F6',
    image: almatyMap,
  },
  {
    id: 3,
    type: 'content',
    icon: 'bar-chart',
    titleKey: 'onboarding.page3.title',
    descriptionKey: 'onboarding.page3.description',
    color: '#F59E0B',
    image: onboarding3,
  },
  {
    id: 4,
    type: 'notifications',
    icon: 'chatbubbles',
    titleKey: 'onboarding.page4.title',
    descriptionKey: 'onboarding.page4.description',
    color: '#8B5CF6',
    image: onboarding4,
  },
];

export const OnboardingScreen: React.FC<OnboardingScreenProps> = ({ onComplete }) => {
  const [currentPage, setCurrentPage] = useState(0);
  const [locationGranted, setLocationGranted] = useState(false);
  const [notificationsGranted, setNotificationsGranted] = useState(false);
  const [isRequesting, setIsRequesting] = useState(false);
  
  const scrollViewRef = useRef<Animated.ScrollView>(null);
  const { t } = useTranslation();

  // Единое значение для отслеживания свайпа
  const scrollX = useRef(new Animated.Value(0)).current;

  // Автоматический запрос разрешений при смене слайда
  useEffect(() => {
    const currentPageData = onboardingPages[currentPage];
    
    if (currentPageData.type === 'location' && !locationGranted && !isRequesting) {
      requestLocationPermission();
    } else if (currentPageData.type === 'notifications' && !notificationsGranted && !isRequesting) {
      requestNotificationPermission();
    }
    
    OnboardingStorage.setCurrentPage(currentPage);
  }, [currentPage]);

  const requestLocationPermission = async () => {
    setIsRequesting(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') setLocationGranted(true);
    } catch (error) {
      console.error('Location permission error:', error);
    } finally {
      setIsRequesting(false);
    }
  };

  const requestNotificationPermission = async () => {
    setIsRequesting(true);
    try {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status === 'granted') setNotificationsGranted(true);
    } catch (error) {
      console.error('Notification permission error:', error);
    } finally {
      setIsRequesting(false);
    }
  };

  const goToNextPage = () => {
    if (currentPage < onboardingPages.length - 1) {
      scrollViewRef.current?.scrollTo({ x: (currentPage + 1) * width, animated: true });
    } else {
      handleComplete();
    }
  };

  const handleComplete = async () => {
    await OnboardingStorage.setCompleted();
    onComplete();
  };

  // Обновляем текущую страницу только когда скролл завершился
  const handleMomentumScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const newIndex = Math.round(event.nativeEvent.contentOffset.x / width);
    setCurrentPage(newIndex);
  };

  const renderPage = (page: OnboardingPage, index: number) => {
    const isLocationPage = page.type === 'location';
    const isNotificationPage = page.type === 'notifications';
    const isGranted = (isLocationPage && locationGranted) || (isNotificationPage && notificationsGranted);

    // Диапазон скролла для текущей страницы
    const inputRange = [(index - 1) * width, index * width, (index + 1) * width];

    // Разнообразные анимации на основе скролла (Интерполяция)
    const imageTranslateY = scrollX.interpolate({
      inputRange,
      outputRange: [100, 0, 100], // Изображение выезжает снизу
      extrapolate: 'clamp',
    });
    
    const imageScale = scrollX.interpolate({
      inputRange,
      outputRange: [0.4, 1, 0.4], // Эффект приближения
      extrapolate: 'clamp',
    });

    const imageRotate = scrollX.interpolate({
      inputRange,
      outputRange: ['-25deg', '0deg', '25deg'], // Легкое вращение при перелистывании
      extrapolate: 'clamp',
    });

    const contentOpacity = scrollX.interpolate({
      inputRange,
      outputRange: [0, 1, 0], // Плавное появление текста
      extrapolate: 'clamp',
    });

    const contentTranslateY = scrollX.interpolate({
      inputRange,
      outputRange: [40, 0, 40], // Текст немного запаздывает (staggered effect)
      extrapolate: 'clamp',
    });

    return (
      <View key={page.id} style={styles.page}>
        {/* Шапка (Header) статичная */}
        <View style={styles.header}>
          <View style={styles.logo}>
            <Ionicons name="leaf" size={32} color="#10B981" />
            <Text style={styles.logoText}>BirQadam</Text>
          </View>
          {currentPage < onboardingPages.length - 1 && (
            <TouchableOpacity onPress={handleComplete} style={styles.skipButton}>
              <Text style={styles.skipText}>{t('onboarding.skip')}</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Анимированный контент */}
        <View style={styles.animatedContent}>
          <Animated.View 
            style={[
              styles.imageContainer,
              {
                opacity: contentOpacity,
                transform: [
                  { translateY: imageTranslateY },
                  { scale: imageScale },
                  { rotate: imageRotate }
                ],
              }
            ]}
          >
            {page.image ? (
              <Image source={page.image} style={styles.image} resizeMode="contain" />
            ) : (
              <View style={[styles.iconPlaceholder, { backgroundColor: page.color + '15' }]}>
                <Ionicons name={isGranted ? 'checkmark' : page.icon} size={80} color={page.color} />
              </View>
            )}
          </Animated.View>

          <Animated.View 
            style={[
              styles.content,
              {
                opacity: contentOpacity,
                transform: [{ translateY: contentTranslateY }],
              }
            ]}
          >
            <Text style={styles.title}>{t(page.titleKey as any)}</Text>
            <Text style={styles.description}>{t(page.descriptionKey as any)}</Text>
            
            {(isLocationPage || isNotificationPage) && (
              <View style={styles.statusContainer}>
                {isRequesting ? (
                  <>
                    <ActivityIndicator size="small" color="#10B981" />
                    <Text style={styles.statusText}>{t(`onboarding.page${index + 1}.requesting` as any)}</Text>
                  </>
                ) : isGranted ? (
                  <>
                    <Ionicons name="checkmark-circle" size={24} color="#10B981" />
                    <Text style={[styles.statusText, styles.statusGranted]}>
                      {isLocationPage 
                        ? t('permissions.location.granted' as any)
                        : t('permissions.notifications.granted' as any)}
                    </Text>
                  </>
                ) : (
                  <>
                    <ActivityIndicator size="small" color="#10B981" />
                    <Text style={styles.statusText}>{t(`onboarding.page${index + 1}.waiting` as any)}</Text>
                  </>
                )}
              </View>
            )}
          </Animated.View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Animated.ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        // Привязываем scrollX к событию скролла
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: false } // false, так как мы будем анимировать ширину точек
        )}
        onMomentumScrollEnd={handleMomentumScrollEnd}
        scrollEventThrottle={16}
        contentContainerStyle={styles.scrollContent}
      >
        {onboardingPages.map((page, index) => renderPage(page, index))}
      </Animated.ScrollView>

      {/* Вынесли пагинацию и кнопку из страниц, чтобы они были фиксированными снизу */}
      <View style={styles.bottomContainer}>
        <View style={styles.pagination}>
          {onboardingPages.map((_, idx) => {
            const dotInputRange = [(idx - 1) * width, idx * width, (idx + 1) * width];
            
            // Плавная анимация ширины и прозрачности точек
            const dotWidth = scrollX.interpolate({
              inputRange: dotInputRange,
              outputRange: [8, 24, 8],
              extrapolate: 'clamp',
            });
            
            const dotOpacity = scrollX.interpolate({
              inputRange: dotInputRange,
              outputRange: [0.3, 1, 0.3],
              extrapolate: 'clamp',
            });

            const dotColor = scrollX.interpolate({
              inputRange: dotInputRange,
              outputRange: ['#D1D5DB', '#10B981', '#D1D5DB'],
              extrapolate: 'clamp',
            });

            return (
              <Animated.View
                key={idx}
                style={[
                  styles.paginationDot,
                  { width: dotWidth, opacity: dotOpacity, backgroundColor: dotColor },
                ]}
              />
            );
          })}
        </View>

        <Button
          title={currentPage === onboardingPages.length - 1 
            ? t('onboarding.getStarted') 
            : t('onboarding.next')
          }
          onPress={goToNextPage}
          variant="primary"
          style={styles.button}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContent: {
    flexGrow: 1,
  },
  page: {
    width,
    height: height * 0.75, // Оставили место внизу для кнопок
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
  },
  animatedContent: {
    flex: 1,
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    height: 40,
  },
  logo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#10B981',
    marginLeft: 8,
  },
  skipButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  skipText: {
    fontSize: 16,
    color: '#10B981',
    fontWeight: '500',
  },
  imageContainer: {
    flex: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: width - 48,
    height: (width - 48) * 0.75,
    borderRadius: 16,
  },
  iconPlaceholder: {
    width: 200,
    height: 200,
    borderRadius: 100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    marginTop: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: 12,
  },
  description: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 20,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  statusText: {
    fontSize: 14,
    color: '#6B7280',
    marginLeft: 8,
  },
  statusGranted: {
    color: '#10B981',
    fontWeight: '600',
  },
  bottomContainer: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    paddingHorizontal: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    backgroundColor: '#FFFFFF',
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 30,
  },
  paginationDot: {
    height: 8,
    borderRadius: 4,
    marginHorizontal: 4,
  },
  button: {
    width: '100%',
  },
});