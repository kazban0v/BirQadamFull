import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useToast } from '../../components/Toast';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';

import { volunteerAPI } from '../../services/api';
import { getAxiosErrorMessage } from '../../utils/apiErrorMessage';
import { useTaskSyncStore } from '../../store/taskSyncStore';
import type { Task } from '../../types';
import { appColors } from '../../theme';
import { useTranslation } from "../../locales/i18n";

type RootStackParamList = {
  SubmitPhotoReport: { taskId: number };
  VolunteerTaskDetail: { taskId: number };
};

type RouteProps = RouteProp<RootStackParamList, 'SubmitPhotoReport'>;
type NavigationProps = NativeStackNavigationProp<RootStackParamList>;

type SelectedPhoto = ImagePicker.ImagePickerAsset;

const MAX_PHOTOS = 5;
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

const getFileExtension = (asset: SelectedPhoto) => {
  const fromName = asset.fileName?.split('.').pop();
  if (fromName) {
    return fromName.toLowerCase();
  }

  const fromUri = asset.uri.split('.').pop();
  if (fromUri) {
    return fromUri.toLowerCase();
  }

  if (asset.mimeType === 'image/png') {
    return 'png';
  }

  return 'jpg';
};

const getMimeType = (asset: SelectedPhoto) => asset.mimeType || 'image/jpeg';

const getFileName = (asset: SelectedPhoto, index: number) =>
  asset.fileName || `photo-report-${Date.now()}-${index + 1}.${getFileExtension(asset)}`;

const parseTaskDeadline = (dateValue?: string, endTime?: string) => {
  if (!dateValue) {
    return null;
  }

  const [year, month, day] = dateValue.split('-').map((part) => Number(part));
  if (!year || !month || !day) {
    return null;
  }

  const [hours, minutes, seconds] = (endTime || '23:59:59').split(':').map((part) => Number(part));
  return new Date(
    year,
    month - 1,
    day,
    Number.isFinite(hours) ? hours : 23,
    Number.isFinite(minutes) ? minutes : 59,
    Number.isFinite(seconds) ? seconds : 59,
    999
  );
};

const isTaskExpired = (task: Pick<Task, 'status' | 'end_date' | 'end_time' | 'is_expired'>) => {
  if (task.status === 'expired' || task.is_expired) {
    return true;
  }

  const deadline = parseTaskDeadline(task.end_date, task.end_time);
  return Boolean(deadline && Date.now() > deadline.getTime());
};

export const SubmitPhotoReportScreen: React.FC = () => {
    const { t } = useTranslation();
  const toast = useToast();
  const navigation = useNavigation<NavigationProps>();
  const route = useRoute<RouteProps>();
  const { taskId } = route.params;
  const insets = useSafeAreaInsets();
  const publishTaskMutation = useTaskSyncStore((state) => state.publishTaskMutation);

  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [comment, setComment] = useState('');
  const [selectedPhotos, setSelectedPhotos] = useState<SelectedPhoto[]>([]);

  const isExpiredTask = useMemo(() => (task ? isTaskExpired(task) : false), [task]);
  const canUploadForTask = useMemo(() => {
    if (!task) {
      return false;
    }

    if (isExpiredTask) {
      return false;
    }

    if (['archived', 'completed', 'under_review', 'failed', 'closed'].includes(task.status)) {
      return false;
    }

    return Boolean(
      task.status === 'revision' ||
      task.can_upload_photo ||
      (task.accepted && task.status === 'in_progress' && !task.has_photo_report)
    );
  }, [isExpiredTask, task]);

  const loadTask = useCallback(async () => {
    setLoading(true);
    try {
      const response = await volunteerAPI.getTaskDetail(taskId);
      setTask(response.data);
    } catch (error: unknown) {
      const errorMessage = getAxiosErrorMessage(error, t('submitphotoreport.s_0'));

      toast.error(errorMessage);
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  }, [navigation, taskId]);

  useEffect(() => {
    loadTask();
  }, [loadTask]);

  useEffect(() => {
    if (!loading && task && !canUploadForTask) {
      toast.warning(t('submitphotoreport.s_4'));
      navigation.goBack();
    }
  }, [canUploadForTask, loading, navigation, task]);

  const appendAssets = useCallback((assets: SelectedPhoto[]) => {
    setSelectedPhotos((current) => {
      const existingUris = new Set(current.map((item) => item.uri));
      const next = [...current];

      for (const asset of assets) {
        if (next.length >= MAX_PHOTOS) {
          break;
        }

        if (existingUris.has(asset.uri)) {
          continue;
        }

        if (asset.fileSize && asset.fileSize > MAX_FILE_SIZE_BYTES) {
          toast.warning(t('submitphotoreport.s_7'));
          continue;
        }

        next.push(asset);
        existingUris.add(asset.uri);
      }

      return next;
    });
  }, []);

  const handlePickFromLibrary = useCallback(async () => {
    if (selectedPhotos.length >= MAX_PHOTOS) {
      toast.warning(t('submitphotoreport.s_40', { max: MAX_PHOTOS }));
      return;
    }

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      toast.warning(t('submitphotoreport.s_10'));
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: MAX_PHOTOS - selectedPhotos.length,
      quality: 0.8,
    });

    if (result.canceled || !result.assets?.length) {
      return;
    }

    appendAssets(result.assets);
  }, [appendAssets, selectedPhotos.length]);

  const handleTakePhoto = useCallback(async () => {
    if (selectedPhotos.length >= MAX_PHOTOS) {
      toast.warning(t('submitphotoreport.s_40', { max: MAX_PHOTOS }));
      return;
    }

    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      toast.warning(t('submitphotoreport.s_13'));
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.8,
      cameraType: ImagePicker.CameraType.back,
    });

    if (result.canceled || !result.assets?.length) {
      return;
    }

    appendAssets(result.assets);
  }, [appendAssets, selectedPhotos.length]);

  const handleRemovePhoto = useCallback((uri: string) => {
    setSelectedPhotos((current) => current.filter((photo) => photo.uri !== uri));
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!task) {
      return;
    }

    if (!selectedPhotos.length) {
      toast.warning(t('submitphotoreport.s_15'));
      return;
    }

    if (isTaskExpired(task)) {
      toast.warning(t('submitphotoreport.s_17'));
      return;
    }

    const formData = new FormData();

    selectedPhotos.forEach((photo, index) => {
      formData.append('photos', {
        uri: photo.uri,
        name: getFileName(photo, index),
        type: getMimeType(photo),
      } as any);
    });

    if (comment.trim()) {
      formData.append('comment', comment.trim());
    }

    setSubmitting(true);
    try {
      await volunteerAPI.submitPhotoReport(taskId, formData);
      publishTaskMutation({
        taskId,
        reason: 'photo_report_submitted',
        changes: {
          status: 'under_review',
          has_photo_report: true,
          can_upload_photo: false,
          photo_status: 'pending',
          photo_uploaded_at: new Date().toISOString(),
        },
      });

      toast.success(task.status === 'revision' ? t('submitphotoreport.s_19') : t('submitphotoreport.s_20'));
      navigation.goBack();
    } catch (error: unknown) {
      const errorMessage = getAxiosErrorMessage(error, t('submitphotoreport.s_21'));
      toast.error(errorMessage);
    } finally {
      setSubmitting(false);
    }
  }, [comment, navigation, publishTaskMutation, selectedPhotos, task, taskId]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={appColors.primary} />
      </View>
    );
  }

  if (!task || !canUploadForTask) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="small" color={appColors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <StatusBar
        barStyle={appColors.surface === appColors.white ? 'dark-content' : 'light-content'}
        backgroundColor={appColors.surface}
      />

      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerButton}>
          <Ionicons name="arrow-back" size={24} color={appColors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('submitphotoreport.s_23')}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: 156 + Math.max(insets.bottom, 16) }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
      >
        <View style={styles.card}>
          <Text style={styles.cardLabel}>{t('submitphotoreport.s_24')}</Text>
          <Text style={styles.taskTitle} numberOfLines={4}>
            {[task.title, task.description].map((chunk) => chunk?.trim()).find(Boolean) || t('submitphotoreport.s_26')}
          </Text>
          {task.project_title?.trim() ? (
            <Text style={styles.taskSubtitle} numberOfLines={2}>{task.project_title.trim()}</Text>
          ) : null}
        </View>

        {task.status === 'revision' && (
          <View style={[styles.card, styles.warningCard]}>
            <View style={styles.warningHeader}>
              <Ionicons name="refresh-circle-outline" size={20} color="#D97706" />
              <Text style={styles.warningTitle}>{t('submitphotoreport.s_27')}</Text>
            </View>
            <Text style={styles.warningText}>
              {task.rejection_reason || t('submitphotoreport.s_28')}
            </Text>
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{t('submitphotoreport.s_29')}</Text>
          <Text style={styles.sectionHint}>
            {t('submitphotoreport.s_30', { max: MAX_PHOTOS })}
          </Text>

          <View style={styles.actionsRow}>
            <TouchableOpacity style={styles.secondaryAction} onPress={handlePickFromLibrary}>
              <Ionicons name="images-outline" size={18} color={appColors.primary} />
              <Text style={styles.secondaryActionText}>{t('submitphotoreport.s_31')}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.secondaryAction} onPress={handleTakePhoto}>
              <Ionicons name="camera-outline" size={18} color={appColors.primary} />
              <Text style={styles.secondaryActionText}>{t('submitphotoreport.s_32')}</Text>
            </TouchableOpacity>
          </View>

          {selectedPhotos.length ? (
            <View style={styles.photoGrid}>
              {selectedPhotos.map((photo) => (
                <View key={photo.uri} style={styles.photoTile}>
                  <Image source={{ uri: photo.uri }} style={styles.photoPreview} />
                  <TouchableOpacity
                    style={styles.removeButton}
                    onPress={() => handleRemovePhoto(photo.uri)}
                  >
                    <Ionicons name="close" size={16} color={appColors.white} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="image-outline" size={28} color={appColors.textSoft} />
              <Text style={styles.emptyStateText}>{t('submitphotoreport.s_33')}</Text>
            </View>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{t('submitphotoreport.s_34')}</Text>
          {comment.trim().length ? (
            <TouchableOpacity
              style={styles.commentClearAction}
              onPress={() => setComment('')}
              activeOpacity={0.85}
            >
              <Ionicons name="close" size={16} color={appColors.textMuted} />
              <Text style={styles.commentClearActionText}>{t('submitphotoreport.s_35')}</Text>
            </TouchableOpacity>
          ) : null}

          <TextInput
            selectionColor={appColors.primary}
            cursorColor={appColors.primary}
            value={comment}
            onChangeText={setComment}
            placeholder={t('submitphotoreport.s_36')}
            placeholderTextColor={appColors.textSoft}
            multiline
            textAlignVertical="top"
            style={styles.commentInput}
          />
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <Text style={styles.footerHint}>{selectedPhotos.length} / {MAX_PHOTOS} {t('submitphotoreport.s_37')}</Text>
        <TouchableOpacity
          style={[styles.submitButton, (!selectedPhotos.length || submitting) && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={!selectedPhotos.length || submitting}
        >
          {submitting ? (
            <ActivityIndicator size="small" color={appColors.white} />
          ) : (
            <>
              <Ionicons name="cloud-upload-outline" size={20} color={appColors.white} />
              <Text style={styles.submitButtonText}>
                {task.status === 'revision' ? t('submitphotoreport.s_38') : t('submitphotoreport.s_39')}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: appColors.surface,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: appColors.surface,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: appColors.border,
    backgroundColor: appColors.surface,
  },
  headerButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: appColors.text,
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    padding: 16,
    paddingBottom: 140,
    gap: 16,
  },
  card: {
    backgroundColor: appColors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: appColors.border,
  },
  cardLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: appColors.primary,
    marginBottom: 8,
  },
  taskTitle: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '700',
    color: appColors.text,
  },
  taskSubtitle: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    color: appColors.textMuted,
  },
  warningCard: {
    backgroundColor: appColors.warningSurface,
    borderColor: '#B45309',
  },
  warningHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  warningTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: appColors.warning,
  },
  warningText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#FBBF24',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: appColors.text,
  },
  sectionHint: {
    marginTop: 6,
    marginBottom: 16,
    fontSize: 13,
    color: appColors.textMuted,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  secondaryAction: {
    flex: 1,
    minHeight: 48,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    backgroundColor: appColors.primarySurface,
    paddingHorizontal: 12,
  },
  secondaryActionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#047857',
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  photoTile: {
    position: 'relative',
  },
  photoPreview: {
    width: 96,
    height: 96,
    borderRadius: 14,
    backgroundColor: appColors.surfaceSoft,
  },
  removeButton: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(17,24,39,0.85)',
  },
  emptyState: {
    minHeight: 120,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: appColors.border,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
  },
  emptyStateText: {
    fontSize: 14,
    color: appColors.textMuted,
  },
  commentClearAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: appColors.background,
  },
  commentClearActionText: {
    fontSize: 13,
    fontWeight: '600',
    color: appColors.textMuted,
  },
  commentInput: {
    minHeight: 120,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: appColors.border,
    backgroundColor: appColors.background,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 15,
    lineHeight: 22,
    color: appColors.text,
    marginTop: 10,
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24,
    backgroundColor: appColors.surface,
    borderTopWidth: 1,
    borderColor: appColors.border,
  },
  footerHint: {
    fontSize: 13,
    color: appColors.textMuted,
    marginBottom: 12,
  },
  submitButton: {
    minHeight: 56,
    borderRadius: 16,
    backgroundColor: appColors.primary,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  submitButtonDisabled: {
    backgroundColor: appColors.textSoft,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: appColors.white,
  },
});
