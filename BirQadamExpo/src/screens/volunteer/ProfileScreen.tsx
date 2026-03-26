import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  Dimensions,
  StatusBar,
  Switch,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuthStore } from '../../store/authStore';
import { volunteerAPI } from '../../services/api';
import type { User } from '../../types';
import * as ImagePicker from 'expo-image-picker';

const { width } = Dimensions.get('window');

interface VolunteerProfileScreenProps {
  navigation: any;
}

export const VolunteerProfileScreen: React.FC<VolunteerProfileScreenProps> = ({
  navigation,
}) => {
  const { user, logout } = useAuthStore();
  const [profileData, setProfileData] = useState<User | null>(user);

  const fetchProfile = async () => {
    try {
      const response = await volunteerAPI.getProfile();
      setProfileData(response.data);
    } catch (error) {
      console.error('Error fetching profile:', error);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchProfile();
    }, [])
  );

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });

    if (!result.canceled) {
      console.log('Selected image:', result.assets[0].uri);
      // TODO: Implement actual upload to server
      Alert.alert('Загрузка', 'Функция загрузки аватара находится в разработке');
    }
  };

  const handleLogout = () => {
    Alert.alert('Выход', 'Вы уверены, что хотите выйти?', [
      { text: 'Отмена', style: 'cancel' },
      { text: 'Выйти', style: 'destructive', onPress: async () => await logout() },
    ]);
  };

  const [isDarkTheme, setIsDarkTheme] = useState(false);

  const onToggleTheme = () => {
    setIsDarkTheme(!isDarkTheme);
    Alert.alert('В разработке', 'Функция переключения темы появится в ближайших обновлениях.');
  };

  const showInDevelopmentAlert = (featureName: string) => {
    Alert.alert('В разработке', `Функция «${featureName}» находится в разработке и будет доступна скоро.`);
  };

  const onMenuItemPress = (id: string) => {
    switch (id) {
      case 'edit_profile':
        showInDevelopmentAlert('Редактировать профиль');
        break;
      case 'change_password':
        showInDevelopmentAlert('Сменить пароль');
        break;
      case 'stats':
        showInDevelopmentAlert('Моя статистика');
        break;
      case 'notifications':
        navigation.navigate('VolunteerNotifications' as never);
        break;
      case 'language':
        showInDevelopmentAlert('Смена языка');
        break;
      case 'about':
        showInDevelopmentAlert('О приложении');
        break;
      case 'help':
        navigation.navigate('VolunteerHelp' as never);
        break;
      case 'link_telegram':
        showInDevelopmentAlert('Привязка Telegram');
        break;
      default:
        console.log('Menu item pressed:', id);
    }
  };

  // Расчет прогресса уровня
  const currentPoints = profileData?.rating || 0;
  const levelThreshold = 100;
  const nextTarget = (Math.floor(currentPoints / levelThreshold) + 1) * levelThreshold;
  const pointsInCurrentLevel = currentPoints % levelThreshold;
  const progress = (pointsInCurrentLevel / levelThreshold) * 100;
  const pointsToNext = nextTarget - currentPoints;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

        {/* Header Section with Gradient */}
        <LinearGradient
          colors={['#10B981', '#059669']}
          style={styles.headerBackground}
        >
          <View style={styles.headerTop}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconButton}>
              <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.iconButton}
              onPress={() => onMenuItemPress('help')}
            >
              <Ionicons name="help-circle-outline" size={26} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          <View style={styles.profileInfo}>
            <View style={styles.avatarWrapper}>
              <View style={styles.avatarContainer}>
                {profileData?.avatar ? (
                  <Image source={{ uri: profileData.avatar }} style={styles.avatarImage} />
                ) : (
                  <View style={styles.placeholderAvatar}>
                    <Ionicons name="person" size={50} color="#FFFFFF" />
                  </View>
                )}
              </View>
              <TouchableOpacity style={styles.editButton} onPress={pickImage}>
                <Ionicons name="pencil" size={16} color="#10B981" />
              </TouchableOpacity>
            </View>

            <Text style={styles.userName}>{profileData?.full_name || 'Волонтер'}</Text>
            <Text style={styles.userEmail}>{profileData?.email || 'email@example.com'}</Text>

            <View style={styles.roleBadge}>
              <Text style={styles.roleText}>ВОЛОНТЕР</Text>
            </View>
          </View>
        </LinearGradient>

        <View style={styles.mainContent}>
          {/* Points Card */}
          <View style={styles.pointsCard}>
            <View style={styles.pointsHeader}>
              <Text style={styles.pointsLabel}>БАЛЛЫ</Text>
              <Text style={styles.pointsValue}>{currentPoints}</Text>
            </View>
            
            <View style={styles.progressBarBg}>
              <View style={[styles.progressBarFill, { width: `${progress}%` }]} />
            </View>
            
            <View style={styles.pointsFooter}>
              <Text style={styles.progressText}>Прогресс уровня</Text>
              <Text style={styles.toNextText}>{pointsToNext} баллов до след. уровня</Text>
            </View>
          </View>

          {/* Stats Grid 1 (TF & Rating) */}
          <View style={styles.statsGridRow}>
            <View style={styles.statCard}>
              <View style={styles.statIconWrapper}>
                <Ionicons name="shield" size={24} color="#10B981" />
              </View>
              <Text style={styles.statCardLabel}>ФАКТОР ДОВЕРИЯ</Text>
              <Text style={styles.statCardValue}>{profileData?.trust_factor || 20}/30</Text>
            </View>

            <View style={styles.statCard}>
              <View style={styles.statIconWrapper}>
                <Ionicons name="star" size={24} color="#F59E0B" />
              </View>
              <Text style={styles.statCardLabel}>ФОТО-РЕЙТИНГ</Text>
              <Text style={styles.statCardValue}>{profileData?.average_rating?.toFixed(1) || '5.0'}/5.0</Text>
            </View>
          </View>

          {/* Stats Tabs Row 2 */}
          <View style={styles.bottomStatsRow}>
            <View style={styles.statTab}>
              <View style={styles.tabIconBg}>
                <Ionicons name="leaf" size={18} color="#10B981" />
              </View>
              <Text style={styles.statTabText}>{profileData?.active_projects || 0} Проектов</Text>
            </View>
            <View style={styles.statTab}>
              <View style={styles.tabIconBg}>
                <Ionicons name="checkbox" size={18} color="#10B981" />
              </View>
              <Text style={styles.statTabText}>{profileData?.tasks_completed || 0} Задач</Text>
            </View>
          </View>
          
          <View style={[styles.bottomStatsRow, { marginTop: 12 }]}>
            <View style={styles.statTab}>
              <View style={styles.tabIconBg}>
                <Ionicons name="time" size={18} color="#10B981" />
              </View>
              <Text style={styles.statTabText}>{Math.round(profileData?.total_hours || 0)} Часов</Text>
            </View>
            <View style={styles.statTab}>
              <View style={styles.tabIconBg}>
                <Ionicons name="camera" size={18} color="#10B981" />
              </View>
              <Text style={styles.statTabText}>{profileData?.total_photos || 0} Фото</Text>
            </View>
          </View>

          {/* Account Settings Section */}
          <Text style={styles.menuSectionTitle}>НАСТРОЙКИ АККАУНТА</Text>
          
          <View style={styles.menuContainer}>
            <TouchableOpacity style={styles.menuItem} onPress={() => onMenuItemPress('edit_profile')}>
              <View style={styles.menuItemLeft}>
                <Ionicons name="person-outline" size={22} color="#64748B" />
                <Text style={styles.menuItemText}>Редактировать профиль</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#CBD5E1" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItem} onPress={() => onMenuItemPress('change_password')}>
              <View style={styles.menuItemLeft}>
                <Ionicons name="lock-closed-outline" size={22} color="#64748B" />
                <Text style={styles.menuItemText}>Изменить пароль</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#CBD5E1" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItem} onPress={() => onMenuItemPress('stats')}>
              <View style={styles.menuItemLeft}>
                <Ionicons name="analytics-outline" size={22} color="#64748B" />
                <Text style={styles.menuItemText}>Моя статистика</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#CBD5E1" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItem} onPress={() => onMenuItemPress('notifications')}>
              <View style={styles.menuItemLeft}>
                <Ionicons name="notifications-outline" size={22} color="#64748B" />
                <Text style={styles.menuItemText}>Уведомления</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#CBD5E1" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItem} onPress={() => onMenuItemPress('language')}>
              <View style={styles.menuItemLeft}>
                <Ionicons name="globe-outline" size={22} color="#64748B" />
                <Text style={styles.menuItemText}>Язык</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={styles.menuValueText}>Русский</Text>
                <Ionicons name="chevron-forward" size={20} color="#CBD5E1" />
              </View>
            </TouchableOpacity>

            <View style={styles.menuItem}>
              <View style={styles.menuItemLeft}>
                <Ionicons name="moon-outline" size={22} color="#64748B" />
                <Text style={styles.menuItemText}>Темная тема</Text>
              </View>
              <Switch 
                value={isDarkTheme} 
                onValueChange={onToggleTheme}
                trackColor={{ false: "#CBD5E1", true: "#10B981" }}
                thumbColor={"#FFFFFF"}
              />
            </View>

            <TouchableOpacity style={styles.menuItem} onPress={() => onMenuItemPress('about')}>
              <View style={styles.menuItemLeft}>
                <Ionicons name="information-circle-outline" size={22} color="#64748B" />
                <Text style={styles.menuItemText}>О приложении</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#CBD5E1" />
            </TouchableOpacity>

            <TouchableOpacity style={[styles.menuItem, { borderBottomWidth: 0 }]} onPress={() => onMenuItemPress('help')}>
              <View style={styles.menuItemLeft}>
                <Ionicons name="help-circle-outline" size={22} color="#64748B" />
                <Text style={styles.menuItemText}>Помощь и поддержка</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#CBD5E1" />
            </TouchableOpacity>
          </View>

          {/* Logout Button */}
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={22} color="#EF4444" />
            <Text style={styles.logoutText}>Выйти</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  scrollContent: {
    paddingBottom: 40,
  },
  headerBackground: {
    paddingTop: 60,
    paddingBottom: 50,
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
    alignItems: 'center',
  },
  headerTop: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    position: 'absolute',
    top: 50,
    zIndex: 10,
  },
  iconButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    padding: 8,
    borderRadius: 12,
  },
  profileInfo: {
    alignItems: 'center',
    marginTop: 10,
  },
  avatarWrapper: {
    position: 'relative',
    marginBottom: 16,
  },
  avatarContainer: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  placeholderAvatar: {
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  editButton: {
    position: 'absolute',
    right: 0,
    top: 5,
    backgroundColor: '#FFFFFF',
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  userName: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 4,
    letterSpacing: -0.5,
  },
  userEmail: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.85)',
    marginBottom: 20,
  },
  roleBadge: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 28,
    paddingVertical: 10,
    borderRadius: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  roleText: {
    color: '#10B981',
    fontWeight: '800',
    fontSize: 13,
    letterSpacing: 1.5,
  },
  mainContent: {
    paddingHorizontal: 20,
    marginTop: -35,
  },
  pointsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 6,
    marginBottom: 24,
  },
  pointsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 16,
  },
  pointsLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 1,
  },
  pointsValue: {
    fontSize: 42,
    fontWeight: '900',
    color: '#10B981',
    lineHeight: 42,
  },
  progressBarBg: {
    height: 12,
    backgroundColor: '#F1F5F9',
    borderRadius: 6,
    marginBottom: 14,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#10B981',
    borderRadius: 6,
  },
  pointsFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#475569',
  },
  toNextText: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '500',
  },
  statsGridRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  statCard: {
    backgroundColor: '#FFFFFF',
    width: (width - 56) / 2,
    borderRadius: 28,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.05,
    shadowRadius: 15,
    elevation: 3,
  },
  statIconWrapper: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  statCardLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94A3B8',
    marginBottom: 6,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  statCardValue: {
    fontSize: 20,
    fontWeight: '900',
    color: '#1E293B',
  },
  bottomStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statTab: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    width: (width - 56) / 2,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#DCFCE7',
  },
  tabIconBg: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  statTabText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#166534',
  },
  menuSectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#94A3B8',
    marginBottom: 16,
    marginLeft: 4,
    letterSpacing: 0.5,
  },
  menuContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 10,
    elevation: 2,
    marginBottom: 10,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuItemText: {
    marginLeft: 14,
    fontSize: 16,
    fontWeight: '600',
    color: '#334155',
  },
  menuValueText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#10B981',
    marginRight: 8,
  },
  switchStub: {
    width: 44,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    paddingHorizontal: 2,
    alignItems: 'flex-end',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginTop: 20,
    paddingVertical: 16,
    paddingHorizontal: 8,
  },
  logoutText: {
    marginLeft: 12,
    color: '#EF4444',
    fontWeight: '700',
    fontSize: 17,
  },
});
