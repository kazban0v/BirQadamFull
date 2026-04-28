import React from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { appColors } from '../../theme';

interface LeaveProjectReasonModalProps {
  visible: boolean;
  projectTitle?: string | null;
  reason: string;
  loading?: boolean;
  onChangeReason: (value: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}

export const LeaveProjectReasonModal: React.FC<LeaveProjectReasonModalProps> = ({
  visible,
  projectTitle,
  reason,
  loading = false,
  onChangeReason,
  onClose,
  onConfirm,
}) => {
  const isConfirmDisabled = !reason.trim() || loading;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <View style={styles.overlay}>
          <View style={styles.content}>
            <View style={styles.header}>
              <View style={styles.iconContainer}>
                <Ionicons name="exit-outline" size={26} color={appColors.danger} />
              </View>
              <Text style={styles.title}>Причина выхода</Text>
            </View>

            {projectTitle ? (
              <Text style={styles.projectTitle} numberOfLines={2}>
                {projectTitle}
              </Text>
            ) : null}

            <Text style={styles.description}>
              Укажите причину, почему вы хотите покинуть проект.
            </Text>

            <View style={styles.warningBox}>
              <Ionicons name="warning-outline" size={18} color={appColors.danger} />
              <Text style={styles.warningText}>
                При выходе из проекта может быть снято 5 баллов Trust Factor.
              </Text>
            </View>

            <TextInput
              style={styles.input}
              placeholder="Напишите причину выхода"
              placeholderTextColor={appColors.textSoft}
              multiline
              numberOfLines={4}
              maxLength={500}
              textAlignVertical="top"
              value={reason}
              onChangeText={onChangeReason}
              editable={!loading}
            />

            <Text style={styles.counter}>{reason.length}/500</Text>

            <View style={styles.actions}>
              <TouchableOpacity
                style={[styles.button, styles.secondaryButton]}
                onPress={onClose}
                disabled={loading}
              >
                <Text style={styles.secondaryButtonText}>Отмена</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.button,
                  styles.primaryButton,
                  isConfirmDisabled && styles.buttonDisabled,
                ]}
                onPress={onConfirm}
                disabled={isConfirmDisabled}
              >
                {loading ? (
                  <ActivityIndicator size="small" color={appColors.white} />
                ) : (
                  <Text style={styles.primaryButtonText}>Выйти</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  keyboardView: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  content: {
    backgroundColor: appColors.surface,
    borderRadius: 24,
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: appColors.dangerSurface,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  title: {
    flex: 1,
    fontSize: 22,
    fontWeight: '700',
    color: appColors.text,
  },
  projectTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: appColors.text,
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    color: appColors.textMuted,
    marginBottom: 14,
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: appColors.dangerSurface,
    borderRadius: 16,
    padding: 12,
    marginBottom: 14,
  },
  warningText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    color: appColors.danger,
    fontWeight: '600',
    marginLeft: 8,
  },
  input: {
    minHeight: 120,
    borderWidth: 1,
    borderColor: appColors.border,
    borderRadius: 16,
    backgroundColor: appColors.background,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 15,
    color: appColors.text,
  },
  counter: {
    marginTop: 8,
    textAlign: 'right',
    fontSize: 12,
    color: appColors.textSoft,
  },
  actions: {
    flexDirection: 'row',
    marginTop: 18,
  },
  button: {
    flex: 1,
    height: 52,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  secondaryButton: {
    backgroundColor: appColors.surfaceSoft,
    marginRight: 10,
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: appColors.text,
  },
  primaryButton: {
    backgroundColor: appColors.danger,
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: appColors.white,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
