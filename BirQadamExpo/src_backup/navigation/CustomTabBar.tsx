import React, { useEffect, useRef } from 'react';
import { View, TouchableOpacity, StyleSheet, Text, Animated, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { appColors } from '../theme';


interface CustomTabBarProps {
  state: any;
  descriptors: any;
  navigation: any;
}

export const CustomTabBar: React.FC<CustomTabBarProps> = ({ state, descriptors, navigation }) => {
  const { width } = useWindowDimensions();
  const safeAreaInsets = useSafeAreaInsets();

  const horizontalPadding = 16;
  const tabBarWidth = width - horizontalPadding * 2;
  const tabWidth = tabBarWidth / state.routes.length;
  const slideAnim = useRef(new Animated.Value(state.index * tabWidth)).current;

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: state.index * tabWidth,
      useNativeDriver: true,
      tension: 65,
      friction: 11,
    }).start();
  }, [slideAnim, state.index, tabWidth]);

  const getIconName = (routeName: string, focused: boolean): keyof typeof Ionicons.glyphMap => {
    switch (routeName) {
      case 'HomeTab':
        return focused ? 'home' : 'home-outline';
      case 'TasksTab':
        return focused ? 'list' : 'list-outline';
      case 'CalendarTab':
        return focused ? 'calendar' : 'calendar-outline';
      case 'ChatsTab':
        return focused ? 'chatbubble-ellipses' : 'chatbubble-ellipses-outline';
      case 'ProfileTab':
        return focused ? 'person' : 'person-outline';
      default:
        return 'help-circle-outline';
    }
  };

  const getLabelText = (routeName: string): string => {
    switch (routeName) {
      case 'HomeTab':
        return 'Главная';
      case 'TasksTab':
        return 'Задачи';
      case 'CalendarTab':
        return 'Календарь';
      case 'ChatsTab':
        return 'Чаты';
      case 'ProfileTab':
        return 'Профиль';
      default:
        return routeName;
    }
  };

  return (
    <View style={[styles.container, { paddingBottom: Math.max(safeAreaInsets.bottom, 16) }]}>
      <View style={styles.tabBar}>
        <Animated.View
          style={[
            styles.slidingPillContainer,
            {
              width: tabWidth,
              transform: [{ translateX: slideAnim }],
            },
          ]}
        >
          <View style={styles.slidingPill} />
        </Animated.View>

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
              activeOpacity={0.82}
            >
              <View style={styles.tabContent}>
                <Ionicons
                  name={iconName}
                  size={22}
                  color={isFocused ? appColors.white : 'rgba(226,232,240,0.74)'}
                />
                {isFocused && (
                  <Text style={styles.tabLabel} numberOfLines={1}>
                    {labelText}
                  </Text>
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
    backgroundColor: appColors.background,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: appColors.primary,
    borderRadius: 32,
    height: 64,
    shadowColor: appColors.black,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 12,
    position: 'relative',
  },
  slidingPillContainer: {
    position: 'absolute',
    height: '100%',
    paddingVertical: 6,
    paddingHorizontal: 6,
  },
  slidingPill: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 26,
  },
  tabButton: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  tabContent: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 40,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: appColors.white,
    marginTop: 2,
  },
});
