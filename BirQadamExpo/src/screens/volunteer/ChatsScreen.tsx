import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Image,
  TextInput,
  Modal,
  Pressable,
  Animated,
  PanResponder,
  Easing,
  Dimensions,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { CompositeNavigationProp, useFocusEffect, useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { MainStackParamList, VolunteerTabsParamList } from '../../navigation/AppNavigator';
import { appColors } from '../../theme';
import { volunteerAPI } from '../../services/api';
import { useTranslation } from "../../locales/i18n";

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SWIPE_THRESHOLD = -80;

type ChatsScreenNavigation = CompositeNavigationProp<
  BottomTabNavigationProp<VolunteerTabsParamList>,
  NativeStackNavigationProp<MainStackParamList>
>;

interface ChatItem {
  id: number;
  title: string;
  avatar: string | null;
  chat_type: 'project' | 'direct' | 'group';
  project_id?: number | null;
  unread_count: number;
  last_message: {
    text: string;
    sender_name: string;
    is_read: boolean;
    created_at: string;
  } | null;
  updated_at: string;
}

// ─── Skeleton Loader ────────────────────────────────────────────────────────
const SkeletonItem = ({ index }: { index: number }) => {
    const { t } = useTranslation();
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, {
          toValue: 1,
          duration: 900,
          delay: index * 80,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(shimmer, {
          toValue: 0,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const opacity = shimmer.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.7] });

  return (
    <Animated.View style={[styles.chatItem, { opacity }]}>
      <View style={[styles.skeletonAvatar]} />
      <View style={styles.chatInfo}>
        <View style={styles.chatHeader}>
          <View style={styles.skeletonTitle} />
          <View style={styles.skeletonTimestamp} />
        </View>
        <View style={styles.skeletonMessage} />
      </View>
    </Animated.View>
  );
};

// ─── Animated Chat Row ───────────────────────────────────────────────────────
const ChatRow = ({
  item,
  index,
  onPress,
  onDelete,
}: {
  item: ChatItem;
  index: number;
  onPress: () => void;
  onDelete: (id: number) => void;
}) => {
  const { t } = useTranslation();
  const translateX = useRef(new Animated.Value(0)).current;
  const rowHeight = useRef(new Animated.Value(1)).current;
  const entryAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const badgePulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(entryAnim, {
      toValue: 1,
      duration: 340,
      delay: index * 55,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, []);

  // Badge pulse for unread
  useEffect(() => {
    if (item.unread_count > 0) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(badgePulse, {
            toValue: 1.18,
            duration: 700,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(badgePulse, {
            toValue: 1,
            duration: 700,
            easing: Easing.in(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      ).start();
    }
  }, [item.unread_count]);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 8 && Math.abs(g.dy) < 12,
      onPanResponderMove: (_, g) => {
        if (g.dx < 0) translateX.setValue(Math.max(g.dx, -100));
      },
      onPanResponderRelease: (_, g) => {
        if (g.dx < SWIPE_THRESHOLD) {
          // Snap open
          Animated.spring(translateX, {
            toValue: -80,
            useNativeDriver: true,
          }).start();
        } else {
          // Snap closed
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  const handleDelete = () => {
    Animated.parallel([
      Animated.timing(translateX, { toValue: -SCREEN_WIDTH, duration: 260, useNativeDriver: true }),
      Animated.timing(rowHeight, { toValue: 0, duration: 280, delay: 120, useNativeDriver: true }),
    ]).start(() => onDelete(item.id));
  };

  const handlePressIn = () => {
    Animated.spring(scaleAnim, { toValue: 0.975, useNativeDriver: true }).start();
  };
  const handlePressOut = () => {
    Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }).start();
  };

  const isSameDay = (left: Date, right: Date) =>
    left.getDate() === right.getDate() &&
    left.getMonth() === right.getMonth() &&
    left.getFullYear() === right.getFullYear();

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    if (isSameDay(date, today)) return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    if (isSameDay(date, yesterday)) return t('chats.s_0');
    return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
  };

  const messageText = item.last_message?.text || t('chats.s_1');
  const displayTime = item.last_message ? formatDate(item.last_message.created_at) : formatDate(item.updated_at);

  const entryStyle = {
    opacity: entryAnim,
    transform: [
      { translateY: entryAnim.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) },
    ],
  };

  return (
    <Animated.View style={[entryStyle, { transform: [{ scaleY: rowHeight }] }]}>
      {/* Swipe-behind delete button */}
      <View style={styles.swipeDeleteBg}>
        <TouchableOpacity style={styles.swipeDeleteBtn} onPress={handleDelete}>
          <Ionicons name="trash-outline" size={22} color="#fff" />
          <Text style={styles.swipeDeleteText}>{t('chats.s_2')}</Text>
        </TouchableOpacity>
      </View>

      <Animated.View
        style={{ transform: [{ translateX }, { scale: scaleAnim }] }}
        {...panResponder.panHandlers}
      >
        <TouchableOpacity
          style={styles.chatItem}
          onPress={onPress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          activeOpacity={1}
        >
          <View style={styles.avatarContainer}>
            {item.avatar ? (
              <Image source={{ uri: item.avatar }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.placeholderAvatar]}>
                <Ionicons
                  name={item.chat_type === 'project' ? 'briefcase' : item.chat_type === 'group' ? 'people' : 'person'}
                  size={24}
                  color={appColors.white}
                />
              </View>
            )}
            {item.unread_count > 0 && (
              <Animated.View style={[styles.unreadDot, { transform: [{ scale: badgePulse }] }]} />
            )}
          </View>

          <View style={styles.chatInfo}>
            <View style={styles.chatHeader}>
              <Text style={styles.chatTitle} numberOfLines={1}>{item.title}</Text>
              <Text style={[styles.timestamp, item.unread_count > 0 && styles.timestampUnread]}>
                {displayTime}
              </Text>
            </View>
            <View style={styles.chatFooter}>
              <Text
                style={[styles.lastMessage, item.unread_count > 0 && styles.lastMessageUnread]}
                numberOfLines={1}
              >
                {item.chat_type === 'group' && item.last_message
                  ? `${item.last_message.sender_name}: ${messageText}`
                  : messageText}
              </Text>
              {item.unread_count > 0 && (
                <Animated.View style={[styles.unreadBadge, { transform: [{ scale: badgePulse }] }]}>
                  <Text style={styles.unreadText}>{item.unread_count}</Text>
                </Animated.View>
              )}
            </View>
          </View>
        </TouchableOpacity>
      </Animated.View>
    </Animated.View>
  );
};

// ─── Filter Chip ─────────────────────────────────────────────────────────────
const FilterChip = ({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) => {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    Animated.sequence([
      Animated.timing(scale, { toValue: 0.9, duration: 80, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, useNativeDriver: true }),
    ]).start();
    onPress();
  };

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        style={[styles.chip, active && styles.chipActive]}
        onPress={handlePress}
        activeOpacity={0.8}
      >
        <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
};

// ─── Main Screen ─────────────────────────────────────────────────────────────
export const ChatsScreen = () => {
  const navigation = useNavigation<ChatsScreenNavigation>();
  const { t } = useTranslation();
  const [chats, setChats] = useState<ChatItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showMenu, setShowMenu] = useState(false);
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'all' | 'project' | 'direct' | 'group'>('all');

  const menuAnim = useRef(new Animated.Value(0)).current;
  const searchFocusAnim = useRef(new Animated.Value(0)).current;
  const headerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(headerAnim, {
      toValue: 1,
      duration: 500,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, []);

  const openMenu = () => {
    setShowMenu(true);
    Animated.spring(menuAnim, { toValue: 1, useNativeDriver: true }).start();
  };

  const closeMenu = () => {
    Animated.timing(menuAnim, { toValue: 0, duration: 180, useNativeDriver: true }).start(() =>
      setShowMenu(false)
    );
  };

  const handleSearchFocus = () => {
    Animated.timing(searchFocusAnim, { toValue: 1, duration: 200, useNativeDriver: false }).start();
  };
  const handleSearchBlur = () => {
    Animated.timing(searchFocusAnim, { toValue: 0, duration: 200, useNativeDriver: false }).start();
  };

  const searchBorderColor = searchFocusAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [appColors.surfaceElevated, appColors.primary],
  });

  const fetchChats = async () => {
    try {
      const response = await volunteerAPI.getChats();
      setChats(response.data.chats || []);
    } catch (error) {
      console.error('Failed to load chats:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      const loadData = () => {
        if (isActive) fetchChats();
      };
      loadData();
      const interval = setInterval(loadData, 10000);
      return () => {
        isActive = false;
        clearInterval(interval);
      };
    }, [])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchChats();
  }, []);

  const handleDelete = (id: number) => {
    setChats((prev) => prev.filter((c) => c.id !== id));
  };

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredChats = chats.filter((chat) => {
    if (showUnreadOnly && chat.unread_count === 0) return false;
    if (activeFilter !== 'all' && chat.chat_type !== activeFilter) return false;
    if (!normalizedQuery) return true;
    const haystack = [chat.title, chat.last_message?.text, chat.last_message?.sender_name]
      .filter(Boolean).join(' ').toLowerCase();
    return haystack.includes(normalizedQuery);
  });

  const totalUnread = chats.reduce((s, c) => s + c.unread_count, 0);

  const renderEmptyState = () => {
    const isFiltered = Boolean(normalizedQuery) || showUnreadOnly || activeFilter !== 'all';
    return (
      <View style={styles.emptyContainer}>
        <View style={styles.emptyIconContainer}>
          <Ionicons name={isFiltered ? 'search' : 'chatbubbles'} size={64} color={appColors.primary} />
        </View>
        <Text style={styles.emptyTitle}>{isFiltered ? t('chats.s_3') : t('chats.s_4')}</Text>
        <Text style={styles.emptySubtitle}>
          {isFiltered
            ? t('chats.s_5')
            : t('chats.s_6')}
        </Text>
        <TouchableOpacity
          style={styles.exploreButton}
          onPress={() => {
            if (isFiltered) { setSearchQuery(''); setShowUnreadOnly(false); setActiveFilter('all'); return; }
            navigation.navigate('HomeTab');
          }}
        >
          <Text style={styles.exploreButtonText}>{isFiltered ? t('chats.s_7') : t('chats.s_8')}</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const menuScale = menuAnim.interpolate({ inputRange: [0, 1], outputRange: [0.88, 1] });
  const menuOpacity = menuAnim;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* ── Header ── */}
      <Animated.View
        style={[
          styles.header,
          {
            opacity: headerAnim,
            transform: [{ translateY: headerAnim.interpolate({ inputRange: [0, 1], outputRange: [-16, 0] }) }],
          },
        ]}
      >
        <View style={styles.headerTitleContainer}>
          <Ionicons name="chatbubbles-outline" size={28} color={appColors.primary} style={styles.headerIcon} />
          <Text style={styles.headerTitle}>{t('chats.s_9')}</Text>
          {totalUnread > 0 && (
            <View style={styles.headerBadge}>
              <Text style={styles.headerBadgeText}>{totalUnread}</Text>
            </View>
          )}
        </View>
        <TouchableOpacity onPress={openMenu} style={styles.menuButton}>
          <Ionicons name="ellipsis-vertical" size={22} color={appColors.text} />
        </TouchableOpacity>
      </Animated.View>

      {/* ── Search ── */}
      <Animated.View style={[styles.searchContainer, { borderColor: searchBorderColor, borderWidth: 1.5 }]}>
        <Ionicons name="search" size={18} color={appColors.textSoft} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder={t('chats.s_10')}
          placeholderTextColor={appColors.textSoft}
          value={searchQuery}
          onChangeText={setSearchQuery}
          onFocus={handleSearchFocus}
          onBlur={handleSearchBlur}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={18} color={appColors.textSoft} />
          </TouchableOpacity>
        )}
      </Animated.View>

      {/* ── Filter Chips ── */}
      <View style={styles.chipsRow}>
        {(['all', 'project',] as const).map((f) => (
          <FilterChip
            key={f}
            label={{ all: t('chats.s_11'), project: t('chats.s_12') }[f]}
            active={activeFilter === f}
            onPress={() => setActiveFilter(f)}
          />
        ))}
        <FilterChip
          label={t('chats.s_13')}
          active={showUnreadOnly}
          onPress={() => setShowUnreadOnly((v) => !v)}
        />
      </View>

      {/* ── List ── */}
      {loading && !refreshing ? (
        <View>
          {Array.from({ length: 7 }).map((_, i) => (
            <SkeletonItem key={i} index={i} />
          ))}
        </View>
      ) : (
        <FlatList
          data={filteredChats}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item, index }) => (
            <ChatRow
              item={item}
              index={index}
              onPress={() =>
                navigation.navigate('ChatDetail', {
                  chatId: item.id,
                  chatTitle: item.title,
                  chatType: item.chat_type,
                })
              }
              onDelete={handleDelete}
            />
          )}
          contentContainerStyle={filteredChats.length === 0 ? styles.listEmpty : styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={renderEmptyState}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[appColors.primary]} />
          }
        />
      )}

      {/* ── Menu Modal ── */}
      <Modal visible={showMenu} transparent animationType="none" onRequestClose={closeMenu}>
        <Pressable style={styles.menuOverlay} onPress={closeMenu}>
          <Animated.View
            style={[
              styles.menuCard,
              { opacity: menuOpacity, transform: [{ scale: menuScale }, { translateY: menuAnim.interpolate({ inputRange: [0, 1], outputRange: [-12, 0] }) }] },
            ]}
          >
            <Pressable onPress={() => undefined}>
              {[
                {
                  icon: 'refresh' as const,
                  label: t('chats.s_14'),
                  onPress: () => { closeMenu(); onRefresh(); },
                },
                {
                  icon: showUnreadOnly ? 'mail-open-outline' : ('mail-unread-outline' as any),
                  label: showUnreadOnly ? t('chats.s_15') : t('chats.s_16'),
                  onPress: () => { setShowUnreadOnly((v) => !v); closeMenu(); },
                },
                {
                  icon: 'close-circle-outline' as const,
                  label: t('chats.s_17'),
                  onPress: () => { setSearchQuery(''); setShowUnreadOnly(false); setActiveFilter('all'); closeMenu(); },
                },
              ].map((item, i) => (
                <React.Fragment key={i}>
                  {i > 0 && <View style={styles.menuDivider} />}
                  <TouchableOpacity style={styles.menuItem} onPress={item.onPress} activeOpacity={0.7}>
                    <View style={styles.menuIconWrap}>
                      <Ionicons name={item.icon} size={17} color={appColors.primary} />
                    </View>
                    <Text style={styles.menuText}>{item.label}</Text>
                    <Ionicons name="chevron-forward" size={14} color={appColors.textSoft} />
                  </TouchableOpacity>
                </React.Fragment>
              ))}
            </Pressable>
          </Animated.View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
};

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: appColors.background },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 14,
  },
  headerTitleContainer: { flexDirection: 'row', alignItems: 'center' },
  headerIcon: { marginRight: 8 },
  headerTitle: { fontSize: 24, fontWeight: '700', color: appColors.text },
  headerBadge: {
    backgroundColor: appColors.primary,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 5,
    marginLeft: 8,
  },
  headerBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  menuButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: appColors.surfaceElevated,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Search
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: appColors.surfaceElevated,
    marginHorizontal: 20,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 14,
    marginBottom: 12,
  },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, color: appColors.text, fontSize: 15 },

  // Chips
  chipsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 8,
    gap: 8,
    flexWrap: 'wrap',
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: appColors.surfaceElevated,
    borderWidth: 1,
    borderColor: appColors.borderSoft,
  },
  chipActive: {
    backgroundColor: appColors.primary + '18',
    borderColor: appColors.primary,
  },
  chipText: { fontSize: 13, color: appColors.textSoft, fontWeight: '500' },
  chipTextActive: { color: appColors.primary, fontWeight: '600' },

  // List
  listContent: { paddingHorizontal: 20 },
  listEmpty: { flexGrow: 1 },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Swipe delete
  swipeDeleteBg: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 80,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#EF4444',
    borderRadius: 12,
  },
  swipeDeleteBtn: { alignItems: 'center', gap: 4 },
  swipeDeleteText: { color: '#fff', fontSize: 11, fontWeight: '600' },

  // Chat item
  chatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: appColors.borderSoft,
    backgroundColor: appColors.background,
  },
  avatarContainer: { position: 'relative', marginRight: 14 },
  avatar: { width: 54, height: 54, borderRadius: 27 },
  placeholderAvatar: {
    backgroundColor: appColors.primarySoft,
    justifyContent: 'center',
    alignItems: 'center',
  },
  unreadDot: {
    position: 'absolute',
    bottom: 1,
    right: 1,
    width: 13,
    height: 13,
    borderRadius: 7,
    backgroundColor: appColors.primary,
    borderWidth: 2,
    borderColor: appColors.background,
  },
  chatInfo: { flex: 1 },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 3,
  },
  chatTitle: { fontSize: 15.5, fontWeight: '600', color: appColors.text, flex: 1, marginRight: 8 },
  timestamp: { fontSize: 12, color: appColors.textSoft },
  timestampUnread: { color: appColors.primary, fontWeight: '600' },
  chatFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  lastMessage: { fontSize: 14, color: appColors.textSoft, flex: 1, marginRight: 12 },
  lastMessageUnread: { color: appColors.text, fontWeight: '500' },
  unreadBadge: {
    backgroundColor: appColors.primary,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 5,
  },
  unreadText: { color: '#fff', fontSize: 11, fontWeight: '700' },

  // Skeleton
  skeletonAvatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: appColors.borderSoft,
    marginRight: 14,
  },
  skeletonTitle: { height: 14, width: '55%', borderRadius: 7, backgroundColor: appColors.borderSoft },
  skeletonTimestamp: { height: 12, width: 38, borderRadius: 6, backgroundColor: appColors.borderSoft },
  skeletonMessage: { height: 13, width: '80%', borderRadius: 6, backgroundColor: appColors.borderSoft, marginTop: 8 },

  // Empty
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    marginTop: 40,
  },
  emptyIconContainer: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: appColors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 22,
  },
  emptyTitle: { fontSize: 21, fontWeight: '700', color: appColors.text, marginBottom: 10 },
  emptySubtitle: {
    fontSize: 14.5,
    color: appColors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
  },
  exploreButton: {
    backgroundColor: appColors.primary,
    paddingHorizontal: 28,
    paddingVertical: 13,
    borderRadius: 12,
  },
  exploreButtonText: { color: '#fff', fontSize: 15, fontWeight: '600' },

  // Menu
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.18)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: 90,
    paddingHorizontal: 20,
  },
  menuCard: {
    width: 248,
    backgroundColor: appColors.surface,
    borderRadius: 18,
    paddingVertical: 6,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.14, shadowRadius: 22, shadowOffset: { width: 0, height: 10 } },
      android: { elevation: 10 },
    }),
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  menuIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: appColors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  menuText: { fontSize: 14.5, color: appColors.text, fontWeight: '500', flex: 1 },
  menuDivider: { height: StyleSheet.hairlineWidth, backgroundColor: appColors.borderSoft, marginHorizontal: 16 },
});
