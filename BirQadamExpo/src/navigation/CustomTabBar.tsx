import React, { useEffect, useRef } from 'react';
import { View, TouchableOpacity, StyleSheet, Text, Animated, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface CustomTabBarProps {
  state: any;
  descriptors: any;
  navigation: any;
}

export const CustomTabBar: React.FC<CustomTabBarProps> = ({ state, descriptors, navigation }) => {
  const { width } = useWindowDimensions();
  const safeAreaInsets = useSafeAreaInsets();
  
  // Строгая математика: ширина экрана минус боковые отступы (16 + 16 = 32)
  const HORIZONTAL_PADDING = 16;
  const TAB_BAR_WIDTH = width - (HORIZONTAL_PADDING * 2);
  const TAB_WIDTH = TAB_BAR_WIDTH / state.routes.length;

  // Анимация всегда стартует с текущего индекса
  const slideAnim = useRef(new Animated.Value(state.index * TAB_WIDTH)).current;

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: state.index * TAB_WIDTH,
      useNativeDriver: true,
      tension: 65,
      friction: 11,
    }).start();
  }, [state.index, TAB_WIDTH]);

  const getIconName = (routeName: string, focused: boolean): keyof typeof Ionicons.glyphMap => {
    switch (routeName) {
      case 'Главная': return focused ? 'home' : 'home-outline';
      case 'Задачи': return focused ? 'list' : 'list-outline';
      case 'Календарь': return focused ? 'calendar' : 'calendar-outline';
      case 'Чаты': return focused ? 'chatbubble-ellipses' : 'chatbubble-ellipses-outline';
      case 'Профиль': return focused ? 'person' : 'person-outline';
      default: return 'help-circle-outline';
    }
  };

  const getLabelText = (routeName: string): string => {
    switch (routeName) {
      case 'Главная': return 'Главная';
      case 'Задачи': return 'Задачи';
      case 'Календарь': return 'Календарь';
      case 'Чаты': return 'Чаты';
      case 'Профиль': return 'Профиль';
      default: return routeName;
    }
  };

  return (
    // Контейнер НЕ абсолютный. Он занимает реальное место внизу, чтобы контент не уезжал под него.
    <View style={[
      styles.container, 
      { paddingBottom: Math.max(safeAreaInsets.bottom, 16) }
    ]}>
      <View style={styles.tabBar}>
        
        {/* Анимированная плашка */}
        <Animated.View
          style={[
            styles.slidingPillContainer,
            {
              width: TAB_WIDTH,
              transform: [{ translateX: slideAnim }],
            },
          ]}
        >
          <View style={styles.slidingPill} />
        </Animated.View>

        {/* Кнопки вкладок */}
        {state.routes.map((route: any, index: number) => {
          const { options } = descriptors[route.key];
          const isFocused = state.index === index;
          const iconName = getIconName(route.name, isFocused);
          const labelText = getLabelText(route.name);

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          return (
            <TouchableOpacity
              key={route.key}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              accessibilityLabel={options.tabBarAccessibilityLabel}
              onPress={onPress}
              style={styles.tabButton}
              activeOpacity={0.8}
            >
              <View style={styles.tabContent}>
                <Ionicons
                  name={iconName}
                  size={22}
                  color={isFocused ? '#FFFFFF' : '#9CA3AF'}
                />
                {isFocused && (
                  <Text style={styles.tabLabel} numberOfLines={1}>{labelText}</Text>
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#F9FAFB', // Должен совпадать с фоном всего приложения, чтобы казался прозрачным
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#1A2517',
    borderRadius: 32,
    height: 64, // Фиксированная высота панели
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    position: 'relative',
  },
  slidingPillContainer: {
    position: 'absolute',
    height: '100%',
    paddingVertical: 6, // Отступы сверху и снизу внутри панели
    paddingHorizontal: 6, // Отступы по бокам для плашки
  },
  slidingPill: {
    flex: 1,
    backgroundColor: '#ACC8A2',
    borderRadius: 26, // Чуть меньше радиуса родителя
  },
  tabButton: {
    flex: 1, // Равномерно делит ширину (из-за этого математика работает идеально)
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1, // Поверх плашки
  },
  tabContent: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 40,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#FFFFFF',
    marginTop: 2,
  },
});
