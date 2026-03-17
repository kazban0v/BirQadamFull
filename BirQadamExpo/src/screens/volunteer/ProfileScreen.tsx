import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Header } from '../../components/Header';
import { Input } from '../../components/Input';
import { Button } from '../../components/Button';
import { useAuthStore } from '../../store/authStore';
import * as ImagePicker from 'expo-image-picker';

interface VolunteerProfileScreenProps {
  navigation: any;
}

export const VolunteerProfileScreen: React.FC<VolunteerProfileScreenProps> = ({
  navigation,
}) => {
  const { user, logout, updateProfile } = useAuthStore();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: user?.full_name || '',
    phone_number: user?.phone_number || '',
    email: user?.email || '',
  });

  const pickImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (permissionResult.granted === false) {
      Alert.alert('Разрешение требуется', 'Необходимо разрешение на доступ к фото');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });

    if (!result.canceled) {
      // TODO: Загрузка аватара на сервер
      console.log('Selected image:', result.assets[0].uri);
    }
  };

  const handleSave = async () => {
    try {
      await updateProfile?.(formData);
      setIsEditing(false);
      Alert.alert('Успешно', 'Профиль обновлён');
    } catch (error) {
      Alert.alert('Ошибка', 'Не удалось обновить профиль');
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Выход',
      'Вы уверены, что хотите выйти?',
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Выйти',
          style: 'destructive',
          onPress: async () => {
            await logout();
          },
        },
      ]
    );
  };

  const handleAchievementsPress = () => {
    // Проверяем, существует ли экран в навигации
    if (navigation.getState().routes.some((route: any) => route.name === 'VolunteerAchievements')) {
      navigation.navigate('VolunteerAchievements');
    } else {
      // Если экран не зарегистрирован, показываем сообщение
      Alert.alert('В разработке', 'Раздел достижений находится в разработке');
    }
  };

  const MenuItem = ({ icon, title, onPress, showArrow = true }: any) => (
    <TouchableOpacity style={styles.menuItem} onPress={onPress}>
      <Ionicons name={icon} size={24} color="#6B7280" />
      <Text style={styles.menuItemText}>{title}</Text>
      {showArrow && <Ionicons name="chevron-forward" size={24} color="#9CA3AF" />}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <Header title="Профиль" showBack />
      
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Avatar */}
        <View style={styles.avatarContainer}>
          <TouchableOpacity onPress={pickImage}>
            <View style={styles.avatar}>
              {user?.avatar ? (
                <Image source={{ uri: user.avatar }} style={styles.avatarImage} />
              ) : (
                <Ionicons name="person" size={40} color="#FFFFFF" />
              )}
            </View>
            <View style={styles.editAvatarButton}>
              <Ionicons name="camera" size={16} color="#FFFFFF" />
            </View>
          </TouchableOpacity>
          <Text style={styles.userName}>{user?.full_name}</Text>
          <Text style={styles.userEmail}>{user?.email}</Text>
        </View>

        {/* Stats */}
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>0</Text>
            <Text style={styles.statLabel}>Задач</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>0</Text>
            <Text style={styles.statLabel}>Часов</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>0</Text>
            <Text style={styles.statLabel}>Баллов</Text>
          </View>
        </View>

        {/* Menu */}
        <View style={styles.menuContainer}>
          <MenuItem icon="person" title="Личные данные" onPress={() => setIsEditing(!isEditing)} />
          <MenuItem icon="shield-checkmark" title="Достижения" onPress={handleAchievementsPress} />
          <MenuItem icon="notifications" title="Уведомления" onPress={() => navigation.navigate('VolunteerNotifications')} />
          <MenuItem icon="shield-checkmark-outline" title="Разрешения" onPress={() => navigation.navigate('PermissionsStatus')} />
          <MenuItem icon="help-circle" title="Помощь" onPress={() => Alert.alert('Помощь', 'Раздел помощи в разработке')} />
          <MenuItem icon="log-out" title="Выйти" onPress={handleLogout} showArrow={false} />
        </View>

        {/* Edit Form */}
        {isEditing && (
          <View style={styles.editForm}>
            <Input
              label="Имя"
              value={formData.name}
              onChangeText={(text) => setFormData({ ...formData, name: text })}
              icon="person"
            />
            <Input
              label="Телефон"
              value={formData.phone_number}
              onChangeText={(text) => setFormData({ ...formData, phone_number: text })}
              keyboardType="phone-pad"
              icon="call"
            />
            <Input
              label="Email"
              value={formData.email}
              onChangeText={(text) => setFormData({ ...formData, email: text })}
              keyboardType="email-address"
              icon="mail"
              editable={false}
            />
            <Button title="Сохранить" onPress={handleSave} />
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  avatarContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  avatarImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  editAvatarButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#6B7280',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  userName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
    marginTop: 12,
  },
  userEmail: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#10B981',
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    backgroundColor: '#F3F4F6',
    marginHorizontal: 8,
  },
  menuContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  menuItemText: {
    flex: 1,
    fontSize: 16,
    color: '#1F2937',
    marginLeft: 12,
  },
  editForm: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
  },
});