import React, { useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { appColors, appRadius, appSpace, appTypography } from '../../theme';
import { useModerationStore } from '../../store/moderationStore';
import { useToast } from '../../components/Toast';

interface BlockedUsersScreenProps {
  navigation: any;
}

export function BlockedUsersScreen({ navigation }: BlockedUsersScreenProps) {
  const { fetchBlockedUsers, unblockUser, isLoading } = useModerationStore();
  const [blocks, setBlocks] = React.useState<any[]>([]);
  const toast = useToast();

  useEffect(() => {
    loadBlocks();
  }, []);

  const loadBlocks = async () => {
    try {
      const { moderationAPI } = require('../../services/api');
      const response = await moderationAPI.getBlockedUsers();
      setBlocks(response.data);
    } catch (error) {
      toast.error('Не удалось загрузить список заблокированных пользователей.');
    }
  };

  const handleUnblock = async (blockId: number, userId: number) => {
    try {
      await unblockUser(blockId, userId);
      setBlocks(blocks.filter((b) => b.id !== blockId));
      toast.success('Пользователь разблокирован.');
    } catch (error) {
      toast.error('Не удалось разблокировать пользователя.');
    }
  };

  const renderItem = ({ item }: { item: any }) => (
    <View style={styles.userCard}>
      <View style={styles.userInfo}>
        <View style={styles.avatarPlaceholder}>
          <Ionicons name="person" size={24} color={appColors.textMuted} />
        </View>
        <View style={styles.userText}>
          <Text style={styles.userName}>{item.blocked_name || item.blocked_username || 'Пользователь'}</Text>
        </View>
      </View>
      <TouchableOpacity
        style={styles.unblockButton}
        onPress={() => handleUnblock(item.id, item.blocked_user_id)}
      >
        <Text style={styles.unblockButtonText}>Разблокировать</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={appColors.primary} />
        </View>
      ) : blocks.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="shield-checkmark-outline" size={64} color={appColors.textMuted} />
          <Text style={styles.emptyText}>У вас нет заблокированных пользователей</Text>
        </View>
      ) : (
        <FlatList
          data={blocks}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderItem}
          contentContainerStyle={styles.listContainer}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: appColors.background,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: appSpace.xl,
  },
  emptyText: {
    ...appTypography.body,
    color: appColors.textSecondary,
    textAlign: 'center',
    marginTop: appSpace.md,
  },
  listContainer: {
    padding: appSpace.md,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: appColors.surfaceElevated,
    padding: appSpace.md,
    borderRadius: appRadius.md,
    marginBottom: appSpace.md,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: appColors.surfaceSoft,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: appSpace.md,
  },
  userText: {
    flex: 1,
  },
  userName: {
    ...appTypography.bodyStrong,
    color: appColors.text,
  },
  unblockButton: {
    paddingHorizontal: appSpace.md,
    paddingVertical: appSpace.sm,
    borderRadius: appRadius.pill,
    backgroundColor: appColors.primarySoft,
  },
  unblockButtonText: {
    ...appTypography.caption,
    color: appColors.primaryDark,
    fontWeight: '600',
  },
});
