import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TouchableWithoutFeedback,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { appColors, appRadius, appSpace, appTypography } from '../theme';
import { useModerationStore } from '../store/moderationStore';

interface ModerationMenuProps {
  targetUserId?: number;
  targetName?: string;
  contentType: 'user_profile' | 'chat_message' | 'photo_report' | 'project';
  contentId?: number;
  iconColor?: string;
}

const REPORT_REASONS = [
  'Спам',
  'Оскорбление',
  'Мошенничество',
  'Неприемлемый контент',
  'Нарушение авторских прав',
  'Другое',
];

export function ModerationMenu({
  targetUserId,
  targetName,
  contentType,
  contentId,
  iconColor = appColors.textMuted,
}: ModerationMenuProps) {
  const [menuVisible, setMenuVisible] = useState(false);
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [details, setDetails] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { blockUser, reportContent } = useModerationStore();

  const handleBlock = () => {
    if (!targetUserId) return;
    setMenuVisible(false);
    Alert.alert(
      'Заблокировать пользователя?',
      `Вы больше не будете видеть сообщения и материалы от пользователя ${targetName || ''}.`,
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Заблокировать',
          style: 'destructive',
          onPress: async () => {
            try {
              await blockUser(targetUserId);
              Alert.alert('Успешно', 'Пользователь заблокирован.');
            } catch (error) {
              Alert.alert('Ошибка', 'Не удалось заблокировать пользователя.');
            }
          },
        },
      ]
    );
  };

  const handleReportSubmit = async () => {
    if (!selectedReason) {
      Alert.alert('Внимание', 'Выберите причину жалобы');
      return;
    }
    
    setIsSubmitting(true);
    try {
      await reportContent({
        reported_user_id: targetUserId,
        content_type: contentType,
        content_id: contentId,
        reason: selectedReason,
        details: details,
      });
      setReportModalVisible(false);
      Alert.alert('Спасибо', 'Ваша жалоба отправлена модераторам.');
      setSelectedReason(null);
      setDetails('');
    } catch (error) {
      Alert.alert('Ошибка', 'Не удалось отправить жалобу. Попробуйте позже.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <TouchableOpacity onPress={() => setMenuVisible(true)} style={styles.iconButton}>
        <Ionicons name="ellipsis-horizontal" size={24} color={iconColor} />
      </TouchableOpacity>

      {/* Action Sheet */}
      <Modal visible={menuVisible} transparent animationType="fade">
        <TouchableWithoutFeedback onPress={() => setMenuVisible(false)}>
          <View style={styles.overlay}>
            <TouchableWithoutFeedback>
              <View style={styles.menuContainer}>
                <View style={styles.dragIndicator} />
                
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => {
                    setMenuVisible(false);
                    setTimeout(() => setReportModalVisible(true), 300);
                  }}
                >
                  <Ionicons name="flag-outline" size={24} color={appColors.danger} />
                  <Text style={[styles.menuText, { color: appColors.danger }]}>Пожаловаться</Text>
                </TouchableOpacity>

                {targetUserId && (
                  <TouchableOpacity style={styles.menuItem} onPress={handleBlock}>
                    <Ionicons name="ban-outline" size={24} color={appColors.textSecondary} />
                    <Text style={styles.menuText}>Заблокировать пользователя</Text>
                  </TouchableOpacity>
                )}
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Report Modal */}
      <Modal visible={reportModalVisible} transparent animationType="slide">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.overlay}
        >
          <View style={styles.reportContainer}>
            <View style={styles.reportHeader}>
              <Text style={styles.reportTitle}>Жалоба</Text>
              <TouchableOpacity onPress={() => setReportModalVisible(false)}>
                <Ionicons name="close" size={24} color={appColors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.reportSubtitle}>Укажите причину вашей жалобы:</Text>

            <View style={styles.reasonsList}>
              {REPORT_REASONS.map((reason) => (
                <TouchableOpacity
                  key={reason}
                  style={[
                    styles.reasonItem,
                    selectedReason === reason && styles.reasonItemSelected,
                  ]}
                  onPress={() => setSelectedReason(reason)}
                >
                  <Text
                    style={[
                      styles.reasonText,
                      selectedReason === reason && styles.reasonTextSelected,
                    ]}
                  >
                    {reason}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TextInput
              style={styles.detailsInput}
              placeholder="Дополнительные детали (необязательно)"
              placeholderTextColor={appColors.textSoft}
              multiline
              value={details}
              onChangeText={setDetails}
            />

            <TouchableOpacity
              style={[
                styles.submitButton,
                (!selectedReason || isSubmitting) && styles.submitButtonDisabled,
              ]}
              disabled={!selectedReason || isSubmitting}
              onPress={handleReportSubmit}
            >
              {isSubmitting ? (
                <ActivityIndicator color={appColors.white} />
              ) : (
                <Text style={styles.submitButtonText}>Отправить</Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  iconButton: {
    padding: appSpace.xs,
  },
  overlay: {
    flex: 1,
    backgroundColor: appColors.overlay,
    justifyContent: 'flex-end',
  },
  menuContainer: {
    backgroundColor: appColors.surfaceElevated,
    borderTopLeftRadius: appRadius.xl,
    borderTopRightRadius: appRadius.xl,
    padding: appSpace.lg,
    paddingBottom: Platform.OS === 'ios' ? appSpace.xxl : appSpace.lg,
  },
  dragIndicator: {
    width: 40,
    height: 4,
    backgroundColor: appColors.borderStrong,
    borderRadius: appRadius.pill,
    alignSelf: 'center',
    marginBottom: appSpace.lg,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: appSpace.md,
  },
  menuText: {
    ...appTypography.bodyStrong,
    marginLeft: appSpace.md,
    color: appColors.text,
  },
  reportContainer: {
    backgroundColor: appColors.surfaceElevated,
    borderTopLeftRadius: appRadius.xl,
    borderTopRightRadius: appRadius.xl,
    padding: appSpace.lg,
    paddingBottom: Platform.OS === 'ios' ? appSpace.xxl : appSpace.lg,
    maxHeight: '90%',
  },
  reportHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: appSpace.md,
  },
  reportTitle: {
    ...appTypography.sectionTitle,
    color: appColors.text,
  },
  reportSubtitle: {
    ...appTypography.body,
    color: appColors.textSecondary,
    marginBottom: appSpace.md,
  },
  reasonsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: appSpace.sm,
    marginBottom: appSpace.lg,
  },
  reasonItem: {
    borderWidth: 1,
    borderColor: appColors.borderStrong,
    borderRadius: appRadius.pill,
    paddingVertical: appSpace.sm,
    paddingHorizontal: appSpace.md,
  },
  reasonItemSelected: {
    backgroundColor: appColors.primarySurfaceStrong,
    borderColor: appColors.primary,
  },
  reasonText: {
    ...appTypography.caption,
    color: appColors.textSecondary,
  },
  reasonTextSelected: {
    color: appColors.primaryDark,
    fontWeight: '600',
  },
  detailsInput: {
    backgroundColor: appColors.backgroundElevated,
    borderRadius: appRadius.md,
    padding: appSpace.md,
    minHeight: 80,
    textAlignVertical: 'top',
    ...appTypography.body,
    color: appColors.text,
    marginBottom: appSpace.lg,
  },
  submitButton: {
    backgroundColor: appColors.primary,
    borderRadius: appRadius.md,
    paddingVertical: appSpace.md,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: appColors.primarySoft,
    opacity: 0.7,
  },
  submitButtonText: {
    ...appTypography.bodyStrong,
    color: appColors.white,
  },
});
