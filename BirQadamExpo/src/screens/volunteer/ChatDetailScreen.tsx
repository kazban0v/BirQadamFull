import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image,
  Modal,
  Alert,
  Pressable,
  useWindowDimensions,
  Animated,
  Easing,
} from 'react-native';
import { useRoute, useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { appColors } from '../../theme';
import { volunteerAPI } from '../../services/api';
import { getAxiosErrorMessage, getAxiosErrorResponse } from '../../utils/apiErrorMessage';
import { useAuthStore } from '../../store/authStore';
import { useTranslation } from "../../locales/i18n";

interface ChatMessage {
  id: number;
  text: string;
  sender_id: number;
  sender_name: string;
  avatar?: string | null;
  message_type: string;
  image_url?: string | null;
  file_url?: string | null;
  is_read: boolean;
  created_at: string;
}

interface Attachment {
  uri: string;
  type: 'image';
  name: string;
  mimeType: string;
  file?: Blob | null;
  objectUrl?: string | null;
}

type MessageFilter = 'all' | 'photos' | 'mine';

// Message bubble (animated)
const MessageBubble = ({
  item,
  isMe,
  isSystem,
  showsAvatar,
  bubbleMaxWidth,
  imageSize,
  isCompactScreen,
}: {
  item: ChatMessage;
  isMe: boolean;
  isSystem: boolean;
  showsAvatar: boolean;
  bubbleMaxWidth: number;
  imageSize: number;
  isCompactScreen: boolean;
}) => {
    const { t } = useTranslation();
  const entryAnim = useRef(new Animated.Value(0)).current;
  const pressScale = useRef(new Animated.Value(1)).current;
  const hasImage = Boolean(item.image_url);
  const hasFile = Boolean(item.file_url);
  const messageText = item.text?.trim() ?? '';
  const hasText = messageText.length > 0;

  useEffect(() => {
    Animated.spring(entryAnim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 80,
      friction: 9,
    }).start();
  }, []);

  const handlePressIn = () =>
    Animated.spring(pressScale, { toValue: 0.97, useNativeDriver: true }).start();
  const handlePressOut = () =>
    Animated.spring(pressScale, { toValue: 1, useNativeDriver: true }).start();

  const formatMessageTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  };

  if (isSystem) {
    return (
      <Animated.View
        style={[
          styles.systemMessageContainer,
          {
            opacity: entryAnim,
            transform: [{ scale: entryAnim.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) }],
          },
        ]}
      >
        <Text style={styles.systemMessageText}>{item.text}</Text>
      </Animated.View>
    );
  }

  return (
    <Animated.View
      style={[
        styles.messageWrapper,
        isMe ? styles.messageWrapperMe : styles.messageWrapperOther,
        {
          opacity: entryAnim,
          transform: [
            {
              translateX: entryAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [isMe ? 24 : -24, 0],
              }),
            },
            { scale: pressScale },
          ],
        },
      ]}
    >
      {showsAvatar &&
        (item.avatar ? (
          <Image source={{ uri: item.avatar }} style={styles.messageAvatar} />
        ) : (
          <View style={[styles.messageAvatar, styles.messageAvatarPlaceholder]}>
            <Ionicons name="person" size={16} color={appColors.white} />
          </View>
        ))}

      <TouchableOpacity
        activeOpacity={1}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
      >
        <View style={[styles.messageColumn, { maxWidth: bubbleMaxWidth }]}>
          {showsAvatar && (
            <Text style={styles.senderName}>{item.sender_name}</Text>
          )}

          <View
            style={[
              styles.messageBubble,
              isMe ? styles.messageBubbleMe : styles.messageBubbleOther,
              {
                maxWidth: bubbleMaxWidth,
                paddingHorizontal: isCompactScreen ? 12 : 16,
                paddingVertical: isCompactScreen ? 10 : 12,
              },
            ]}
          >
            {hasImage ? (
              <Image
                source={{ uri: item.image_url ?? undefined }}
                style={[styles.messageImage, { width: imageSize, height: imageSize }]}
                resizeMode="cover"
              />
            ) : null}

            {hasFile ? (
              <View style={styles.fileContainer}>
                <View style={styles.fileIconBox}>
                  <Ionicons name="document-text" size={24} color={appColors.white} />
                </View>
                <View>
                  <Text style={styles.fileName}>{t('chatdetail.s_0')}</Text>
                  <Text style={styles.fileMeta}>{t('chatdetail.s_1')}</Text>
                </View>
              </View>
            ) : null}

            {hasText ? (
              <Text style={isMe ? styles.messageTextMe : styles.messageTextOther}>
                {messageText}
              </Text>
            ) : null}

            <View style={styles.messageFooter}>
              <Text style={isMe ? styles.messageTimeMe : styles.messageTimeOther}>
                {formatMessageTime(item.created_at)}
              </Text>
              {isMe && (
                <Ionicons
                  name="checkmark-done"
                  size={15}
                  color={item.is_read ? appColors.primaryDark : 'rgba(0,0,0,0.28)'}
                  style={styles.readIcon}
                />
              )}
            </View>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

// Send button
const SendButton = ({
  onPress,
  active,
  sending,
}: {
  onPress: () => void;
  active: boolean;
  sending: boolean;
}) => {
  const scaleAnim = useRef(new Animated.Value(active ? 1 : 0.8)).current;
  const opacityAnim = useRef(new Animated.Value(active ? 1 : 0.45)).current;
  const pressScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: active ? 1 : 0.82,
        useNativeDriver: true,
        tension: 120,
        friction: 8,
      }),
      Animated.timing(opacityAnim, {
        toValue: active ? 1 : 0.45,
        duration: 160,
        useNativeDriver: true,
      }),
    ]).start();
  }, [active]);

  const handlePressIn = () =>
    Animated.spring(pressScale, { toValue: 0.88, useNativeDriver: true }).start();
  const handlePressOut = () =>
    Animated.spring(pressScale, { toValue: 1, useNativeDriver: true }).start();

  return (
    <Animated.View
      style={[
        styles.sendButton,
        !active && styles.sendButtonDisabled,
        { opacity: opacityAnim, transform: [{ scale: scaleAnim }, { scale: pressScale }] },
      ]}
    >
      <TouchableOpacity
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={!active || sending}
        style={styles.sendButtonInner}
      >
        {sending ? (
          <ActivityIndicator size="small" color={appColors.white} />
        ) : (
          <Ionicons name="send" size={18} color={appColors.white} />
        )}
      </TouchableOpacity>
    </Animated.View>
  );
};

// Filter chip
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
      Animated.timing(scale, { toValue: 0.88, duration: 70, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, useNativeDriver: true }),
    ]).start();
    onPress();
  };

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        style={[styles.filterChip, active && styles.filterChipActive]}
        onPress={handlePress}
        activeOpacity={0.8}
      >
        <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
          {label}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
};

// Main layout
export const ChatDetailScreen = () => {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const { chatId, chatTitle, chatType } = route.params;
  const { t } = useTranslation();

  const { user } = useAuthStore();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const [showHeaderMenu, setShowHeaderMenu] = useState(false);
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [chatUnavailable, setChatUnavailable] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [messageFilter, setMessageFilter] = useState<MessageFilter>('all');

  const flatListRef = useRef<FlatList>(null);
  const headerAnim = useRef(new Animated.Value(0)).current;
  const inputFocusAnim = useRef(new Animated.Value(0)).current;
  const headerMenuAnim = useRef(new Animated.Value(0)).current;
  const attachMenuAnim = useRef(new Animated.Value(0)).current;
  const filterBannerAnim = useRef(new Animated.Value(0)).current;
  const attachPreviewAnim = useRef(new Animated.Value(0)).current;
  const errorBannerAnim = useRef(new Animated.Value(0)).current;
  const attachmentRef = useRef<Attachment | null>(null);

  useEffect(() => {
    Animated.timing(headerAnim, {
      toValue: 1,
      duration: 400,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, []);

  // Filter banner animation
  useEffect(() => {
    Animated.timing(filterBannerAnim, {
      toValue: messageFilter !== 'all' ? 1 : 0,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [messageFilter]);

  // Attachment preview animation
  useEffect(() => {
    Animated.spring(attachPreviewAnim, {
      toValue: attachment ? 1 : 0,
      useNativeDriver: true,
      tension: 100,
      friction: 10,
    }).start();
  }, [attachment]);

  // Error banner animation
  useEffect(() => {
    Animated.timing(errorBannerAnim, {
      toValue: errorMessage ? 1 : 0,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [errorMessage]);

  useEffect(() => {
    attachmentRef.current = attachment;
  }, [attachment]);

  useEffect(() => {
    return () => {
      if (
        Platform.OS === 'web' &&
        attachmentRef.current?.objectUrl &&
        typeof URL !== 'undefined' &&
        typeof URL.revokeObjectURL === 'function'
      ) {
        URL.revokeObjectURL(attachmentRef.current.objectUrl);
      }
    };
  }, []);

  const openHeaderMenu = () => {
    setShowHeaderMenu(true);
    Animated.spring(headerMenuAnim, { toValue: 1, useNativeDriver: true, tension: 80, friction: 9 }).start();
  };
  const closeHeaderMenu = () => {
    Animated.timing(headerMenuAnim, { toValue: 0, duration: 180, useNativeDriver: true }).start(() =>
      setShowHeaderMenu(false)
    );
  };

  const openAttachMenu = () => {
    setShowAttachmentMenu(true);
    Animated.spring(attachMenuAnim, { toValue: 1, useNativeDriver: true, tension: 80, friction: 9 }).start();
  };
  const closeAttachMenu = (onClosed?: () => void) => {
    Animated.timing(attachMenuAnim, { toValue: 0, duration: 180, useNativeDriver: true }).start(() => {
      setShowAttachmentMenu(false);
      if (onClosed) {
        setTimeout(onClosed, 500);
      }
    });
  };

  const getMimeType = (
    fileName: string,
    providedMimeType?: string | null,
  ) => {
    if (providedMimeType) return providedMimeType;
    const extension = fileName.split('.').pop()?.toLowerCase();
    const mimeByExtension: Record<string, string> = {
      jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
      webp: 'image/webp', heic: 'image/heic',
    };
    if (extension && mimeByExtension[extension]) return mimeByExtension[extension];
    return 'image/jpeg';
  };

  const clearAttachment = useCallback(() => {
    setAttachment((current) => {
      if (
        Platform.OS === 'web' &&
        current?.objectUrl &&
        typeof URL !== 'undefined' &&
        typeof URL.revokeObjectURL === 'function'
      ) {
        URL.revokeObjectURL(current.objectUrl);
      }
      return null;
    });
  }, []);

  const fetchMessages = async () => {
    if (chatUnavailable) return;
    try {
      const response = await volunteerAPI.getChatMessages(chatId);
      setMessages((response.data.messages || []).reverse());
      setErrorMessage('');
      await volunteerAPI.markMessagesRead(chatId);
    } catch (error: unknown) {
      const statusCode = getAxiosErrorResponse(error)?.status;
      if (statusCode === 404 && chatType === 'project') {
        setChatUnavailable(true);
        setErrorMessage(t('chatdetail.s_2'));
        return;
      }
      setErrorMessage(getAxiosErrorMessage(error, t('chatdetail.s_3')));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMessages();
    const interval = setInterval(() => {
      if (!chatUnavailable) fetchMessages();
    }, 5000);
    return () => clearInterval(interval);
  }, [chatId, chatUnavailable]);

  const handleSend = async () => {
    if (!text.trim() && !attachment) return;
    setSending(true);
    try {
      if (attachment) {
        const formData = new FormData();
        if (Platform.OS === 'web' && attachment.file) {
          formData.append('image', attachment.file, attachment.name);
        } else {
          formData.append('image', {
            uri: attachment.uri,
            name: attachment.name,
            type: attachment.mimeType,
          } as any);
        }
        if (text.trim()) formData.append('text', text.trim());
        await volunteerAPI.sendMessage(chatId, formData);
        clearAttachment();
      } else {
        await volunteerAPI.sendMessage(chatId, text.trim());
      }
      setText('');
      setErrorMessage('');
      await fetchMessages();
    } catch (error: unknown) {
      Alert.alert(t('chatdetail.s_4'), getAxiosErrorMessage(error, t('chatdetail.s_5')));
    } finally {
      setSending(false);
    }
  };

  const handlePickImage = async () => {
    try {
      if (Platform.OS === 'web') {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';

        input.onchange = () => {
          const file = input.files?.[0];
          if (!file) return;

          const objectUrl = URL.createObjectURL(file);
          setAttachment((current) => {
            if (
              current?.objectUrl &&
              typeof URL !== 'undefined' &&
              typeof URL.revokeObjectURL === 'function'
            ) {
              URL.revokeObjectURL(current.objectUrl);
            }

            return {
              uri: objectUrl,
              type: 'image',
              name: file.name || `photo_${Date.now()}.jpg`,
              mimeType: file.type || getMimeType(file.name || 'photo.jpg'),
              file,
              objectUrl,
            };
          });
        };

        input.click();
        return;
      }

      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(t('chatdetail.s_6'), t('chatdetail.s_7'));
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.8,
      });

      if (result.canceled || !result.assets?.length) {
        return;
      }

      const asset = result.assets[0];
      setAttachment({
        uri: asset.uri,
        type: 'image',
        name: asset.fileName || `photo_${Date.now()}.jpg`,
        mimeType: getMimeType(asset.fileName || 'photo.jpg', asset.mimeType),
        file: null,
        objectUrl: null,
      });
    } catch (error) {
      console.error('Image picker error:', error);
      Alert.alert(t('chatdetail.s_8'), t('chatdetail.s_9'));
    }
  };

  const chatStatusLabel =
    chatType === 'project' ? t('chatdetail.s_10')
    : chatType === 'group' ? t('chatdetail.s_11')
    : t('chatdetail.s_12');

  const activeFilterCount = messageFilter === 'all' ? 0 : 1;
  const currentFilterLabel =
    messageFilter === 'photos' ? t('chatdetail.s_13')
    : messageFilter === 'mine' ? t('chatdetail.s_14')
    : t('chatdetail.s_15');


  const filteredMessages = messages.filter((item) => {
    if (item.message_type === 'system') return messageFilter === 'all';
    if (messageFilter === 'photos') return Boolean(item.image_url);
    if (messageFilter === 'mine') return item.sender_id === user?.id;
    return true;
  });


  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const isMe = item.sender_id === user?.id;
    const isSystem = item.message_type === 'system';
    const showsAvatar = !isMe && chatType === 'project';
    const isCompactScreen = screenWidth < 390;
    const bubbleMaxWidth = Math.max(
      170,
      Math.min(screenWidth - (showsAvatar ? 118 : 78), isCompactScreen ? 276 : 304)
    );
    const imageSize = Math.max(148, Math.min(bubbleMaxWidth - 24, screenWidth * 0.58));

    return (
      <MessageBubble
        item={item}
        isMe={isMe}
        isSystem={isSystem}
        showsAvatar={showsAvatar}
        bubbleMaxWidth={bubbleMaxWidth}
        imageSize={imageSize}
        isCompactScreen={isCompactScreen}
      />
    );
  };

  const inputBorderColor = inputFocusAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [appColors.borderSoft ?? '#E2E8F0', appColors.primary],
  });

  const menuSlide = (anim: Animated.Value) => ({
    opacity: anim,
    transform: [
      { scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1] }) },
      { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) },
    ],
  });

  return (
    <View style={styles.container}>
[object Object]
      <Animated.View
        style={[
          styles.header,
          { paddingTop: Math.max(insets.top, 16) },
          {
            opacity: headerAnim,
            transform: [{ translateY: headerAnim.interpolate({ inputRange: [0, 1], outputRange: [-10, 0] }) }],
          },
        ]}
      >
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={appColors.text} />
        </TouchableOpacity>

        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle} numberOfLines={1}>{chatTitle}</Text>
          <Text style={styles.headerStatus}>{chatStatusLabel}</Text>
        </View>

        <TouchableOpacity style={styles.moreButton} onPress={openHeaderMenu}>
          <Ionicons name="options-outline" size={22} color={appColors.text} />
          {activeFilterCount > 0 && (
            <View style={styles.headerFilterBadge}>
              <Text style={styles.headerFilterBadgeText}>{activeFilterCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </Animated.View>

[object Object]
      {messageFilter !== 'all' && (
        <Animated.View
          style={[
            styles.activeFilterBanner,
            {
              opacity: filterBannerAnim,
              transform: [{ translateY: filterBannerAnim.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] }) }],
            },
          ]}
        >
          <View style={styles.activeFilterLabel}>
            <Ionicons name="funnel-outline" size={15} color={appColors.primary} />
            <Text style={styles.activeFilterText}>{currentFilterLabel}</Text>
          </View>
          <TouchableOpacity onPress={() => setMessageFilter('all')}>
            <Ionicons name="close-circle" size={20} color={appColors.textSoft} />
          </TouchableOpacity>
        </Animated.View>
      )}

[object Object]
      {errorMessage ? (
        <Animated.View
          style={[
            styles.errorBanner,
            {
              opacity: errorBannerAnim,
              transform: [{ translateY: errorBannerAnim.interpolate({ inputRange: [0, 1], outputRange: [-6, 0] }) }],
            },
          ]}
        >
          <Ionicons name="alert-circle-outline" size={15} color={appColors.danger} style={{ marginRight: 6 }} />
          <Text style={styles.errorBannerText}>{errorMessage}</Text>
        </Animated.View>
      ) : null}

[object Object]
      {loading ? (
        <ActivityIndicator style={styles.loader} size="large" color={appColors.primary} />
      ) : chatUnavailable ? (
        <View style={styles.unavailableContainer}>
          <View style={styles.unavailableIconWrap}>
            <Ionicons name="lock-closed-outline" size={36} color={appColors.textSoft} />
          </View>
          <Text style={styles.unavailableTitle}>{t('chatdetail.s_16')}</Text>
          <Text style={styles.unavailableText}>{errorMessage}</Text>
          <TouchableOpacity style={styles.unavailableButton} onPress={() => navigation.goBack()}>
            <Text style={styles.unavailableButtonText}>{t('chatdetail.s_17')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={filteredMessages}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderMessage}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          inverted
          ListEmptyComponent={
            <View style={styles.filteredEmptyState}>
              <Ionicons name="funnel-outline" size={22} color={appColors.textSoft} />
              <Text style={styles.filteredEmptyStateText}>
                {t('chatdetail.s_18')}</Text>
            </View>
          }
        />
      )}

[object Object]
      {!chatUnavailable && attachment && (
        <Animated.View
          style={[
            styles.attachmentPreview,
            {
              opacity: attachPreviewAnim,
              transform: [{ translateY: attachPreviewAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
            },
          ]}
        >
          <View style={styles.attachmentInfo}>
            {attachment.type === 'image' ? (
              <Image source={{ uri: attachment.uri }} style={styles.attachmentImagePreview} />
            ) : (
              <View style={styles.attachmentFilePreview}>
                <Ionicons name="document-text-outline" size={20} color={appColors.primary} />
              </View>
            )}
            <Text style={styles.attachmentText} numberOfLines={1}>
              {attachment.name}
            </Text>
          </View>
          <TouchableOpacity onPress={clearAttachment} style={styles.attachmentRemove}>
            <Ionicons name="close-circle" size={22} color={appColors.danger} />
          </TouchableOpacity>
        </Animated.View>
      )}

[object Object]
      {!chatUnavailable && (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + 12 : 0}
        >
          <View style={[styles.inputContainer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            <TouchableOpacity style={styles.attachButton} onPress={openAttachMenu}>
              <Ionicons name="attach" size={26} color={appColors.textSoft} />
            </TouchableOpacity>

            <Animated.View style={[styles.textInputWrapper, { borderColor: inputBorderColor }]}>
              <TextInput
                style={styles.textInput}
                placeholder={t('chatdetail.s_19')}
                placeholderTextColor={appColors.textSoft}
                value={text}
                onChangeText={setText}
                onFocus={() =>
                  Animated.timing(inputFocusAnim, { toValue: 1, duration: 200, useNativeDriver: false }).start()
                }
                onBlur={() =>
                  Animated.timing(inputFocusAnim, { toValue: 0, duration: 200, useNativeDriver: false }).start()
                }
                multiline
                maxLength={1000}
              />
            </Animated.View>

            <SendButton
              onPress={handleSend}
              active={Boolean(text.trim() || attachment)}
              sending={sending}
            />
          </View>
        </KeyboardAvoidingView>
      )}

[object Object]
      <Modal visible={showHeaderMenu} transparent animationType="none" onRequestClose={closeHeaderMenu}>
        <Pressable style={styles.modalOverlay} onPress={closeHeaderMenu}>
          <Animated.View style={[styles.modalCard, menuSlide(headerMenuAnim)]}>
            <Pressable onPress={() => undefined}>
              <View style={styles.sheetHandle} />
              <Text style={styles.modalTitle}>{t('chatdetail.s_20')}</Text>

              <View style={styles.filterOptionsGrid}>
                {(['all', 'photos', 'mine'] as MessageFilter[]).map((f) => (
                  <FilterChip
                    key={f}
                    label={{ all: t('chatdetail.s_21'), photos: t('chatdetail.s_22'), mine: t('chatdetail.s_23') }[f]}
                    active={messageFilter === f}
                    onPress={() => { setMessageFilter(f); closeHeaderMenu(); }}
                  />
                ))}
              </View>

              <View style={styles.menuDivider} />

              {[
                {
                  icon: 'refresh' as const,
                  label: t('chatdetail.s_24'),
                  onPress: () => { closeHeaderMenu(); fetchMessages(); },
                },
                {
                  icon: 'checkmark-done-outline' as const,
                  label: t('chatdetail.s_25'),
                  onPress: async () => {
                    closeHeaderMenu();
                    await volunteerAPI.markMessagesRead(chatId);
                    fetchMessages();
                  },
                },
                ...(messageFilter !== 'all'
                  ? [{
                      icon: 'close-circle-outline' as const,
                      label: t('chatdetail.s_26'),
                      onPress: () => { setMessageFilter('all'); closeHeaderMenu(); },
                    }]
                  : []),
              ].map((item, i) => (
                <TouchableOpacity key={i} style={styles.modalItem} onPress={item.onPress} activeOpacity={0.7}>
                  <View style={styles.menuIconWrap}>
                    <Ionicons name={item.icon} size={16} color={appColors.primary} />
                  </View>
                  <Text style={styles.modalItemText}>{item.label}</Text>
                  <Ionicons name="chevron-forward" size={14} color={appColors.textSoft} />
                </TouchableOpacity>
              ))}
            </Pressable>
          </Animated.View>
        </Pressable>
      </Modal>

[object Object]
      <Modal visible={showAttachmentMenu} transparent animationType="none" onRequestClose={() => closeAttachMenu()}>
        <Pressable style={styles.modalOverlay} onPress={() => closeAttachMenu()}>
          <Animated.View style={[styles.modalCard, menuSlide(attachMenuAnim)]}>
            <Pressable onPress={() => undefined}>
              <View style={styles.sheetHandle} />
              <Text style={styles.modalTitle}>{t('chatdetail.s_27')}</Text>
              {[
                {
                  icon: 'image-outline' as const,
                  label: t('chatdetail.s_28'),
                  onPress: () => closeAttachMenu(() => { void handlePickImage(); }),
                },
              ].map((item, i) => (
                <TouchableOpacity key={i} style={styles.modalItem} onPress={item.onPress} activeOpacity={0.7}>
                  <View style={styles.menuIconWrap}>
                    <Ionicons name={item.icon} size={16} color={appColors.primary} />
                  </View>
                  <Text style={styles.modalItemText}>{item.label}</Text>
                  <Ionicons name="chevron-forward" size={14} color={appColors.textSoft} />
                </TouchableOpacity>
              ))}
            </Pressable>
          </Animated.View>
        </Pressable>
      </Modal>
    </View>
  );
};

// Styles
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: appColors.background },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: appColors.surface,
    paddingBottom: 14,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: appColors.borderSoft,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: appColors.surfaceElevated,
    marginRight: 8,
  },
  headerTitleContainer: { flex: 1, alignItems: 'center', paddingHorizontal: 6 },
  headerTitle: { fontSize: 17, fontWeight: '700', color: appColors.text },
  headerStatus: { fontSize: 12, color: appColors.primary, marginTop: 2, fontWeight: '500' },
  moreButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: appColors.surfaceElevated,
    marginLeft: 8,
  },
  headerFilterBadge: {
    position: 'absolute',
    top: 3,
    right: 3,
    minWidth: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: appColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  headerFilterBadgeText: { fontSize: 9, fontWeight: '700', color: '#fff' },

  // Banners
  activeFilterBanner: {
    marginHorizontal: 14,
    marginTop: 10,
    marginBottom: 2,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 12,
    backgroundColor: appColors.primary + '12',
    borderWidth: 1,
    borderColor: appColors.primary + '22',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  activeFilterLabel: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 10 },
  activeFilterText: { fontSize: 13, fontWeight: '600', color: appColors.primary, marginLeft: 7 },
  errorBanner: {
    marginHorizontal: 14,
    marginTop: 10,
    marginBottom: 2,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 12,
    backgroundColor: 'rgba(239, 68, 68, 0.07)',
    flexDirection: 'row',
    alignItems: 'center',
  },
  errorBannerText: { color: appColors.danger, fontSize: 13, fontWeight: '500', flex: 1 },

  // List
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { paddingHorizontal: 14, paddingVertical: 20, flexGrow: 1 },

  // System message
  systemMessageContainer: {
    alignSelf: 'center',
    backgroundColor: appColors.surfaceMuted,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 14,
    marginVertical: 10,
  },
  systemMessageText: { fontSize: 12, color: appColors.textMuted, fontWeight: '500' },

  // Message wrapper
  messageWrapper: { flexDirection: 'row', marginBottom: 14, width: '100%' },
  messageWrapperMe: { justifyContent: 'flex-end' },
  messageWrapperOther: { justifyContent: 'flex-start' },
  messageColumn: { alignItems: 'flex-start' },
  messageAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    marginRight: 8,
    alignSelf: 'flex-end',
  },
  messageAvatarPlaceholder: {
    backgroundColor: appColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  senderName: { fontSize: 12, color: appColors.textSoft, marginBottom: 3, marginLeft: 4 },
  messageBubble: { borderRadius: 18 },
  messageBubbleMe: {
    backgroundColor: '#DCF8C6',
    borderBottomRightRadius: 4,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
      android: { elevation: 2 },
    }),
  },
  messageBubbleOther: {
    backgroundColor: appColors.surfaceElevated,
    borderBottomLeftRadius: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: appColors.borderSoft,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 3, shadowOffset: { width: 0, height: 1 } },
      android: { elevation: 1 },
    }),
  },
  messageTextMe: { fontSize: 15, color: appColors.text, lineHeight: 22 },
  messageTextOther: { fontSize: 15, color: appColors.text, lineHeight: 22 },
  messageImage: { borderRadius: 12, marginBottom: 6 },
  fileContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: appColors.primary,
    padding: 10,
    borderRadius: 10,
    marginBottom: 6,
  },
  fileIconBox: { marginRight: 10 },
  fileName: { fontSize: 13, fontWeight: '600', color: '#fff' },
  fileMeta: { fontSize: 11, color: 'rgba(255,255,255,0.75)' },
  messageFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 3 },
  messageTimeMe: { fontSize: 11, color: 'rgba(0,0,0,0.35)' },
  messageTimeOther: { fontSize: 11, color: appColors.textSoft },
  readIcon: { marginLeft: 3 },

  // Attachment preview
  attachmentPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: appColors.surfaceElevated,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: appColors.borderSoft,
  },
  attachmentInfo: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 12 },
  attachmentImagePreview: { width: 42, height: 42, borderRadius: 9, marginRight: 10 },
  attachmentFilePreview: {
    width: 42,
    height: 42,
    borderRadius: 9,
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: appColors.primary + '18',
  },
  attachmentText: { fontSize: 13, color: appColors.text, flex: 1 },
  attachmentRemove: { padding: 2 },

  // Input
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingTop: 10,
    backgroundColor: appColors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: appColors.borderSoft,
    gap: 8,
  },
  attachButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: appColors.surfaceElevated,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  textInputWrapper: {
    flex: 1,
    backgroundColor: appColors.surfaceElevated,
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 10 : 7,
    maxHeight: 120,
    marginBottom: 6,
    borderWidth: 1.5,
  },
  textInput: { fontSize: 15.5, color: appColors.text, maxHeight: 80 },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: appColors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
    overflow: 'hidden',
  },
  sendButtonDisabled: { backgroundColor: appColors.surfaceMuted },
  sendButtonInner: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' },

  // Empty state
  filteredEmptyState: {
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 22,
    paddingVertical: 28,
    marginTop: 20,
    borderRadius: 16,
    backgroundColor: appColors.surfaceElevated,
  },
  filteredEmptyStateText: {
    marginTop: 9,
    fontSize: 13.5,
    fontWeight: '500',
    color: appColors.textSoft,
    textAlign: 'center',
  },

  // Unavailable
  unavailableContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  unavailableIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: appColors.surfaceElevated,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  unavailableTitle: { fontSize: 21, fontWeight: '700', color: appColors.text, marginBottom: 8 },
  unavailableText: {
    fontSize: 15,
    color: appColors.textSoft,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  unavailableButton: {
    backgroundColor: appColors.primary,
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 13,
  },
  unavailableButtonText: { color: '#fff', fontSize: 15, fontWeight: '600' },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.2)',
    justifyContent: 'flex-end',
    paddingHorizontal: 14,
    paddingBottom: 20,
  },
  modalCard: {
    backgroundColor: appColors.surface,
    borderRadius: 20,
    paddingVertical: 6,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.14, shadowRadius: 24, shadowOffset: { width: 0, height: -4 } },
      android: { elevation: 12 },
    }),
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 42,
    height: 4,
    borderRadius: 999,
    backgroundColor: appColors.borderSoft,
    marginTop: 10,
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: appColors.text,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  filterOptionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 9,
    paddingHorizontal: 14,
    marginBottom: 10,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: appColors.surfaceElevated,
    borderWidth: 1,
    borderColor: appColors.borderSoft,
  },
  filterChipActive: { backgroundColor: appColors.primary, borderColor: appColors.primary },
  filterChipText: { fontSize: 14, fontWeight: '600', color: appColors.text },
  filterChipTextActive: { color: '#fff' },
  menuDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: appColors.borderSoft,
    marginHorizontal: 14,
    marginVertical: 4,
  },
  menuIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: appColors.primary + '14',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  modalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  modalItemText: { fontSize: 14.5, color: appColors.text, fontWeight: '500', flex: 1 },
});
