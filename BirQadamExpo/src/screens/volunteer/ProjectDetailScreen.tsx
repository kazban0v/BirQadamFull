import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  Linking,
  Share,
  Modal,
  Animated,
  RefreshControl,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { volunteerAPI } from '../../services/api';
import type { Project } from '../../types';
import { normalizeImageUrl } from '../../utils/network';
import { getAxiosErrorMessage, getAxiosErrorResponse } from '../../utils/apiErrorMessage';
import { appColors } from '../../theme';
import { useTranslation } from "../../locales/i18n";
import { ProjectCoverPlaceholder } from '../../components/dashboard/ProjectCoverPlaceholder';

interface RouteParams {
  projectId: number;
}

interface ProjectDetailScreenProps {
  navigation: any;
  route: {
    params: RouteParams;
  };
}

export const VolunteerProjectDetailScreen = ({
  navigation,
  route,
}: ProjectDetailScreenProps) => {
    const { t } = useTranslation();
  const { projectId } = route.params;
  const insets = useSafeAreaInsets();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const isCompactProjectModal = screenWidth <= 390;
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);
  const [showAllParticipants, setShowAllParticipants] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [trustFactor, setTrustFactor] = useState<number | null>(null);
  const [showLeaveWarning, setShowLeaveWarning] = useState(false);
  const [showLeaveReasonModal, setShowLeaveReasonModal] = useState(false);
  const [leaveReason, setLeaveReason] = useState('');
  const [showJoinConfirm, setShowJoinConfirm] = useState(false);
  const [showJoinSuccess, setShowJoinSuccess] = useState(false);
  const [showLeaveSuccess, setShowLeaveSuccess] = useState(false);
  const [leaveSuccessData, setLeaveSuccessData] = useState<{
    message: string;
    trustFactor?: number;
    penaltyApplied?: boolean;
  } | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successData, setSuccessData] = useState<{
    message: string;
    newTF: number;
    penaltyApplied: boolean;
  } | null>(null);
  
  // Анимации для плавного появления контента
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  
  // Анимация для кнопки "Присоединиться"
  const buttonScale = useRef(new Animated.Value(1)).current;
  const buttonPulse = useRef(new Animated.Value(1)).current;
  const [isButtonPressed, setIsButtonPressed] = useState(false);

  // Функция для нормализации URL изображений

  const loadProjectDetail = async (isRefresh = false) => {
    if (!isRefresh) {
      setLoading(true);
    }
    try {
      const response = await volunteerAPI.getProjectDetail(projectId);
      const projectData = response.data;
      setProject(projectData);
      
      if (__DEV__) {
        console.log('Project loaded:', {
          id: projectData.id,
          title: projectData.title,
          joined: projectData.joined,
        });
      }
      
      try {
        const profileResponse = await volunteerAPI.getProfile();
        if (profileResponse.data?.trust_factor !== undefined) {
          setTrustFactor(profileResponse.data.trust_factor);
        }
      } catch (error) {
        console.error('Error loading trust factor:', error);
      }
      
      if (!isRefresh) {
        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(slideAnim, {
            toValue: 0,
            duration: 600,
            useNativeDriver: true,
          }),
        ]).start();
      }
    } catch (error: unknown) {
      console.error('Error loading project detail:', error);
      const errorMessage = getAxiosErrorMessage(error, t('projectdetail.s_0'));
      if (!isRefresh) {
        Alert.alert(t('projectdetail.s_1'), errorMessage);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };
  
  const onRefresh = async () => {
    setRefreshing(true);
    await loadProjectDetail(true);
  };
  
  useEffect(() => {
    if (project && !project.joined && !joining && !isButtonPressed) {
      const pulseAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(buttonPulse, {
            toValue: 1.05,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(buttonPulse, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      );
      pulseAnimation.start();
      
      return () => pulseAnimation.stop();
    } else {
      buttonPulse.setValue(1);
    }
  }, [project, joining, isButtonPressed]);

  useEffect(() => {
    fadeAnim.setValue(0);
    slideAnim.setValue(30);
    buttonScale.setValue(1);
    buttonPulse.setValue(1);
    setIsButtonPressed(false);
    
    loadProjectDetail();
  }, [projectId]);


  const handleJoin = async () => {
    if (!project) return;

    if (project.joined) {
      Alert.alert(t('projectdetail.s_2'), t('projectdetail.s_3'));
      return;
    }

    if (trustFactor !== null && trustFactor <= 0) {
      Alert.alert(
        t('projectdetail.s_4'),
        t('projectdetail.s_5')
      );
      return;
    }

    setIsButtonPressed(true);
    Animated.sequence([
      Animated.timing(buttonScale, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(buttonScale, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setIsButtonPressed(false);
    });

    // Показываем кастомное модальное окно подтверждения
    setShowJoinConfirm(true);
  };

  const confirmJoin = async () => {
    if (!project) return;

    setJoining(true);
    try {
      const response = await volunteerAPI.joinProject(project.id);
      const data = response.data;
      
      setProject((prevProject) => {
        if (prevProject) {
          return { ...prevProject, joined: true };
        }
        return prevProject;
      });
      
      // Показываем кастомное модальное окно успеха
      setShowJoinSuccess(true);
      
      // Перезагружаем данные проекта для получения актуальной информации
      await loadProjectDetail(true);
    } catch (error: unknown) {
      console.error('Error joining project:', error);
      const errorMessage = getAxiosErrorMessage(error, t('projectdetail.s_6'));
      const res = getAxiosErrorResponse(error);

      if (res?.status === 403 || res?.status === 400) {
        if (res.data?.trust_factor !== undefined) {
          Alert.alert(
            t('projectdetail.s_7'),
            `Ваш Trust Factor: ${String(res.data.trust_factor)}. ${errorMessage}`
          );
        } else {
          Alert.alert(t('projectdetail.s_8'), errorMessage);
        }
      } else {
        Alert.alert(t('projectdetail.s_9'), errorMessage);
      }
    } finally {
      setJoining(false);
    }
  };
  
  const handleLeave = () => {
    if (!project) return;
    setShowLeaveWarning(true);
  };
  
  const proceedToLeaveReason = () => {
    setShowLeaveWarning(false);
    setLeaveReason('');
    setShowLeaveReasonModal(true);
  };
  
  const confirmLeave = async () => {
    if (!project || !leaveReason.trim()) {
      Alert.alert(t('projectdetail.s_10'), t('projectdetail.s_11'));
      return;
    }

    setLeaving(true);
    try {
      const response = await volunteerAPI.leaveProject(project.id, leaveReason.trim());
      const data = response.data;
      
      // Обновляем Trust Factor
      if (data.trust_factor !== undefined) {
        setTrustFactor(data.trust_factor);
      }
      
      // Закрываем модалку причины
      setShowLeaveReasonModal(false);
      setLeaveReason('');
      
      // Сохраняем данные для показа в модалке успеха
      setLeaveSuccessData({
        message: data.message || t('projectdetail.s_12'),
        trustFactor: data.trust_factor,
        penaltyApplied: data.penalty_applied,
      });
      
      // Показываем модалку успеха
      setShowLeaveSuccess(true);
      
      await loadProjectDetail();
    } catch (error: unknown) {
      console.error('Error leaving project:', error);
      const errorMessage = getAxiosErrorMessage(error, t('projectdetail.s_13'));
      Alert.alert(t('projectdetail.s_14'), errorMessage);
    } finally {
      setLeaving(false);
    }
  };

  const openMap = async () => {
    if (project?.gis2_url && project.gis2_url.trim()) {
      const gis2Url = project.gis2_url.trim();
      const supported = await Linking.canOpenURL(gis2Url);
      if (supported) {
        Linking.openURL(gis2Url);
      } else {
        Alert.alert(t('projectdetail.s_15'), t('projectdetail.s_16'));
      }
      return;
    }
    
    if (project?.latitude && project?.longitude) {
      const url = `https://www.google.com/maps?q=${project.latitude},${project.longitude}`;
      Linking.openURL(url);
      return;
    }
    
    if (project?.address && project.address.trim()) {
      const address = encodeURIComponent(project.address.trim());
      const url = `https://www.google.com/maps/search/?api=1&query=${address}`;
      Linking.openURL(url);
      return;
    }
    
    Alert.alert(t('projectdetail.s_17'), t('projectdetail.s_18'));
  };

  const callPhone = () => {
    if (!project?.contact_phone) {
      Alert.alert(t('projectdetail.s_19'), t('projectdetail.s_20'));
      return;
    }
    Linking.openURL(`tel:${project.contact_phone}`);
  };

  const sendEmail = () => {
    if (!project?.contact_email) {
      Alert.alert(t('projectdetail.s_21'), t('projectdetail.s_22'));
      return;
    }
    Linking.openURL(`mailto:${project.contact_email}`);
  };

  const openTelegram = async () => {
    if (!project?.contact_telegram) {
      Alert.alert(t('projectdetail.s_23'), t('projectdetail.s_24'));
      return;
    }
    
    const username = project.contact_telegram.replace('@', '');
    const url = `https://t.me/${username}`;
    
    const supported = await Linking.canOpenURL(url);
    if (supported) {
      Linking.openURL(url);
    } else {
      Alert.alert(t('projectdetail.s_25'), t('projectdetail.s_26'));
    }
  };

  const openWebsite = async () => {
    if (!project?.info_url) {
      Alert.alert(t('projectdetail.s_27'), t('projectdetail.s_28'));
      return;
    }
    
    const supported = await Linking.canOpenURL(project.info_url);
    if (supported) {
      Linking.openURL(project.info_url);
    } else {
      Alert.alert(t('projectdetail.s_29'), t('projectdetail.s_30'));
    }
  };

  const openOrganizerProfile = () => {
    if (!project?.organizer_id) {
      Alert.alert(t('projectdetail.s_31'), t('projectdetail.s_32'));
      return;
    }
    
    navigation.navigate('OrganizerProfile', { organizerId: project.organizer_id });
  };

  const shareProject = async () => {
    if (!project) return;

    try {
      const portalBase = (
        process.env.EXPO_PUBLIC_PORTAL_URL?.trim() ||
        process.env.EXPO_PUBLIC_FRONTEND_URL?.trim() ||
        'https://birqadam.almau.edu.kz/portal'
      ).replace(/\/+$/, '');
      const projectUrl = `${portalBase}/projects/${project.id}`;
      const shareMessage = `${project.title}\n\n${project.description?.substring(0, 100)}${project.description && project.description.length > 100 ? '...' : ''}\n\n${projectUrl}`;

      const result = await Share.share({
        message: shareMessage,
        title: project.title,
        url: projectUrl,
      });

      if (result.action === Share.sharedAction) {
        if (result.activityType) {
          console.log(t('projectdetail.s_33'), result.activityType);
        } else {
          console.log(t('projectdetail.s_34'));
        }
      } else if (result.action === Share.dismissedAction) {
        console.log(t('projectdetail.s_35'));
      }
    } catch (error: unknown) {
      Alert.alert(t('projectdetail.s_36'), getAxiosErrorMessage(error, t('projectdetail.s_37')));
      console.error('Error sharing project:', error);
    }
  };

  const getVolunteerTypeLabel = (type: string): string => {
    switch (type) {
      case 'social':
        return t('projectdetail.s_38');
      case 'environmental':
        return t('projectdetail.s_39');
      case 'cultural':
        return t('projectdetail.s_40');
      default:
        return type.toUpperCase();
    }
  };

  const getVolunteerTypeColor = (type: string): string => {
    switch (type) {
      case 'social':
        return appColors.primary;
      case 'environmental':
        return appColors.primary;
      case 'cultural':
        return '#8B5CF6';
      default:
        return appColors.textMuted;
    }
  };

  const formatDate = (dateStr: string | null): string => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('ru-RU', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };


  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={appColors.primary} />
      </View>
    );
  }

  if (!project) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={64} color={appColors.textSoft} />
        <Text style={styles.errorText}>{t('projectdetail.s_41')}</Text>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>{t('projectdetail.s_42')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const typeLabel = getVolunteerTypeLabel(project.volunteer_type);
  const typeColor = getVolunteerTypeColor(project.volunteer_type);
  
  const currentTF = trustFactor !== null ? trustFactor : 0;
  const newTF = Math.max(0, currentTF - 5);

  return (
    <View style={styles.container}>
      <ScrollView 
        style={styles.scrollView} 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#10B981"
            colors={[appColors.primary]}
          />
        }
      >
        {/* Header Image */}
        <View style={styles.imageContainer}>
          {normalizeImageUrl(project.cover_image_url) ? (
            <View style={styles.projectImageContainer}>
              {imageLoading && (
                <View style={[styles.projectImage, styles.imagePlaceholder]}>
                  <LinearGradient
                    colors={[appColors.primarySurface, appColors.primarySurfaceStrong, '#047857']}
                    style={StyleSheet.absoluteFill}
                  />
                  <ActivityIndicator size="large" color={appColors.primary} />
                </View>
              )}
              <Image 
                source={{ uri: normalizeImageUrl(project.cover_image_url) }} 
                style={[styles.projectImage, imageLoading && styles.imageHidden]}
                resizeMode="cover"
                onLoadStart={() => setImageLoading(true)}
                onLoadEnd={() => setImageLoading(false)}
                onError={(error) => {
                  console.error('Error loading project image:', error);
                  setImageLoading(false);
                }}
              />
            </View>
          ) : (
            <ProjectCoverPlaceholder style={[styles.projectImage, styles.imagePlaceholder]} size="lg" />
          )}
          
          <TouchableOpacity
            style={[styles.backButtonOverlay, { top: Math.max(50, insets.top + 10) }]}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color={appColors.text} />
          </TouchableOpacity>

          <TouchableOpacity style={[styles.shareButton, { top: Math.max(50, insets.top + 10) }]} onPress={shareProject}>
            <Ionicons name="share-outline" size={24} color={appColors.text} />
          </TouchableOpacity>
        </View>

        {/* Content */}
        <Animated.View 
          style={[
            styles.content,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <View style={[styles.categoryBadge, { backgroundColor: typeColor }]}>
            <Text style={styles.categoryText}>{typeLabel}</Text>
          </View>

          <Text style={styles.title}>{project.title}</Text>

          <TouchableOpacity style={styles.infoRow} onPress={openMap}>
            <View style={styles.infoIcon}>
              <Ionicons name="location-outline" size={18} color={appColors.primary} />
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>{project.city || t('projectdetail.s_43')}</Text>
              <Text style={styles.infoValue}>
                {project.address || t('projectdetail.s_44')}
              </Text>
            </View>
            <TouchableOpacity onPress={openMap} style={styles.mapButton}>
              <Text style={styles.mapButtonText}>{t('projectdetail.s_45')}</Text>
            </TouchableOpacity>
          </TouchableOpacity>

          <View style={[styles.infoRow, styles.infoRowCenter]}>
            <View style={styles.infoIcon}>
              <Ionicons name="calendar-outline" size={18} color={appColors.primary} />
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>
                {formatDate(project.start_date)} - {formatDate(project.end_date)}
              </Text>
            </View>
          </View>

          <TouchableOpacity style={styles.organizerRow} onPress={openOrganizerProfile}>
            <View style={styles.organizerAvatar}>
              <Ionicons name="business-outline" size={20} color={appColors.primary} />
            </View>
            <View style={styles.organizerContent}>
              <Text style={styles.organizerName}>
                {project.organizer_name || t('projectdetail.s_46')}
              </Text>
              {project.organizer?.organization_name ? (
                <Text style={styles.organizerOrganization}>
                  {project.organizer.organization_name}
                </Text>
              ) : (
                <Text style={styles.organizerType}>
                  {t('projectdetail.s_47')}</Text>
              )}
            </View>
            <Text style={styles.organizerMoreButton}>{t('projectdetail.s_48')}</Text>
          </TouchableOpacity>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('projectdetail.s_49')}</Text>
            <Text style={styles.description}>{project.description}</Text>
            
            {project.tags && project.tags.length > 0 && (
              <View style={styles.tagsContainer}>
                {project.tags.map((tag, index) => (
                  <View key={index} style={styles.tag}>
                    <Text style={styles.tagText}>#{tag}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{t('projectdetail.s_50')}</Text>
              {project.participants && project.participants.length > 0 && (
                <Text style={styles.participantsCount}>
                  {project.active_members || project.participants.length}
                </Text>
              )}
            </View>
            {project.participants && project.participants.length > 0 ? (
              <>
                <View style={styles.participantsRow}>
                  <View style={styles.avatarsContainer}>
                    {project.participants.slice(0, 5).map((participant, i) => (
                      <View key={participant.id} style={[styles.avatar, { marginLeft: i > 0 ? -12 : 0 }]}>
                        {participant.avatar_url ? (
                          <Image 
                            source={{ uri: normalizeImageUrl(participant.avatar_url) }} 
                            style={styles.avatarImage}
                            resizeMode="cover"
                          />
                        ) : (
                          <View style={styles.avatarPlaceholder}>
                            <Ionicons name="person" size={14} color={appColors.textMuted} />
                          </View>
                        )}
                      </View>
                    ))}
                  </View>
                  {project.active_members && project.active_members > 5 && (
                    <TouchableOpacity 
                      style={styles.showAllButton}
                      onPress={() => setShowAllParticipants(true)}
                    >
                      <Text style={styles.showAllButtonText}>
                        +{project.active_members - 5} {t('projectdetail.s_51')}</Text>
                    </TouchableOpacity>
                  )}
                </View>
                {project.active_members && project.active_members > 5 && (
                  <TouchableOpacity 
                    style={styles.showAllLink}
                    onPress={() => setShowAllParticipants(true)}
                  >
                    <Text style={styles.showAllLinkText}>{t('projectdetail.s_52')}</Text>
                    <Ionicons name="chevron-forward" size={16} color={appColors.primary} />
                  </TouchableOpacity>
                )}
              </>
            ) : (
              <Text style={styles.noParticipants}>{t('projectdetail.s_53')}</Text>
            )}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('projectdetail.s_54')}</Text>
            <View style={styles.contactsGrid}>
              {project.contact_phone && (
                <TouchableOpacity style={styles.contactButton} onPress={callPhone}>
                  <View style={styles.contactIcon}>
                    <Ionicons name="call-outline" size={20} color={appColors.primary} />
                  </View>
                </TouchableOpacity>
              )}
              {project.contact_email && (
                <TouchableOpacity style={styles.contactButton} onPress={sendEmail}>
                  <View style={styles.contactIcon}>
                    <Ionicons name="mail-outline" size={20} color={appColors.primary} />
                  </View>
                </TouchableOpacity>
              )}
              {project.contact_telegram && (
                <TouchableOpacity style={styles.contactButton} onPress={openTelegram}>
                  <View style={styles.contactIcon}>
                    <Ionicons name="send-outline" size={20} color={appColors.primary} />
                  </View>
                </TouchableOpacity>
              )}
              {project.info_url && (
                <TouchableOpacity style={styles.contactButton} onPress={openWebsite}>
                  <View style={styles.contactIcon}>
                    <Ionicons name="globe-outline" size={20} color={appColors.primary} />
                  </View>
                </TouchableOpacity>
              )}
            </View>
          </View>

          <View style={styles.spacer} />
        </Animated.View>
      </ScrollView>

      {/* Participants Modal */}
      <Modal
        visible={showAllParticipants}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAllParticipants(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: screenHeight * 0.8 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('projectdetail.s_55')}</Text>
              <TouchableOpacity 
                onPress={() => setShowAllParticipants(false)}
                style={styles.modalCloseButton}
              >
                <Ionicons name="close" size={24} color={appColors.textMuted} />
              </TouchableOpacity>
            </View>
            <ScrollView 
              style={styles.modalScrollView}
              showsVerticalScrollIndicator={false}
            >
              {project.participants && project.participants.length > 0 ? (
                project.participants.map((participant) => (
                  <View key={participant.id} style={styles.participantItem}>
                    <View style={styles.participantAvatar}>
                      {participant.avatar_url ? (
                        <Image 
                          source={{ uri: normalizeImageUrl(participant.avatar_url) }} 
                          style={styles.participantAvatarImage}
                          resizeMode="cover"
                        />
                      ) : (
                        <View style={styles.participantAvatarPlaceholder}>
                          <Ionicons name="person" size={20} color={appColors.textMuted} />
                        </View>
                      )}
                    </View>
                    <View style={styles.participantInfo}>
                      <Text style={styles.participantName}>{participant.name}</Text>
                      {participant.joined_at && (
                        <Text style={styles.participantDate}>
                          {t('projectdetail.s_56')}{formatDate(participant.joined_at)}
                        </Text>
                      )}
                    </View>
                  </View>
                ))
              ) : (
                <Text style={styles.noParticipantsModal}>{t('projectdetail.s_57')}</Text>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Leave Warning Modal */}
      <Modal
        visible={showLeaveWarning}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowLeaveWarning(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalKeyboardView}
        >
          <View style={styles.warningModalOverlay}>
            <ScrollView
              contentContainerStyle={styles.warningModalScrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <View
                style={[
                  styles.warningModalContent,
                  isCompactProjectModal && styles.warningModalContentCompact,
                  { maxHeight: screenHeight * (isCompactProjectModal ? 0.88 : 0.82) },
                ]}
              >
                <TouchableOpacity
                  onPress={() => setShowLeaveWarning(false)}
                  style={styles.warningModalCloseButton}
                >
                  <Ionicons name="close" size={22} color={appColors.textMuted} />
                </TouchableOpacity>

                <View style={[styles.warningIconContainer, isCompactProjectModal && styles.warningIconContainerCompact]}>
                  <View style={styles.warningIconCircle}>
                    <Ionicons name="warning" size={40} color={appColors.danger} />
                  </View>
                </View>
                
                <Text style={styles.warningTitle}>{t('projectdetail.s_58')}</Text>
                <Text style={styles.warningSubtitle}>
                  "{project.title}"
                </Text>
                
                <View style={styles.warningInfoBox}>
                  <View style={styles.warningInfoRow}>
                    <Ionicons name="alert-circle" size={20} color={appColors.danger} />
                    <Text style={styles.warningInfoText}>
                      {t('projectdetail.s_59')}</Text>
                  </View>
                  
                  <View style={styles.tfChangeContainer}>
                    <View style={styles.tfBox}>
                      <Text 
                        style={styles.tfLabel}
                        numberOfLines={1}
                        adjustsFontSizeToFit
                      >{t('projectdetail.s_60')}</Text>
                      <Text style={styles.tfValue} numberOfLines={1} adjustsFontSizeToFit>{currentTF}</Text>
                    </View>
                    
                    <Ionicons name="arrow-forward" size={18} color={appColors.textSoft} />
                    
                    <View style={styles.tfBox}>
                      <Text 
                        style={styles.tfLabel}
                        numberOfLines={1}
                        adjustsFontSizeToFit
                      >{t('projectdetail.s_61')}</Text>
                      <Text style={[styles.tfValue, styles.tfValueDanger]} numberOfLines={1} adjustsFontSizeToFit>{newTF}</Text>
                    </View>
                  </View>
                  
                  {newTF === 0 && (
                    <View style={styles.dangerNotice}>
                      <Ionicons name="ban" size={18} color="#DC2626" />
                      <Text style={styles.dangerNoticeText}>
                        {t('projectdetail.s_62')}</Text>
                    </View>
                  )}
                </View>
                
                <View style={styles.warningButtons}>
                  <TouchableOpacity
                    style={[styles.warningButton, styles.warningButtonCancel]}
                    onPress={() => setShowLeaveWarning(false)}
                  >
                    <Text 
                      style={styles.warningButtonCancelText}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                    >{t('projectdetail.s_63')}</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[styles.warningButton, styles.warningButtonContinue]}
                    onPress={proceedToLeaveReason}
                  >
                    <Text 
                      style={styles.warningButtonContinueText}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                    >{t('projectdetail.s_64')}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
      
      {/* Join Confirmation Modal */}
      <Modal
        visible={showJoinConfirm}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowJoinConfirm(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalKeyboardView}
        >
          <View style={styles.confirmModalOverlay}>
            <ScrollView
              contentContainerStyle={styles.confirmModalScrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <View style={[styles.confirmModalContent, { maxHeight: '80%' }]}>
                <View style={styles.confirmIconContainer}>
                  <View style={styles.confirmIconCircle}>
                    <Ionicons name="people" size={48} color={appColors.primary} />
                  </View>
                </View>
                
                <Text style={styles.confirmTitle}>{t('projectdetail.s_65')}</Text>
                <Text style={styles.confirmProjectName}>
                  "{project.title}"
                </Text>
                
                <View style={styles.confirmInfoBox}>
                  <View style={styles.confirmInfoRow}>
                    <Ionicons name="checkmark-circle" size={20} color={appColors.primary} />
                    <Text style={styles.confirmInfoText}>
                      {t('projectdetail.s_66')}</Text>
                  </View>
                  <View style={styles.confirmInfoRow}>
                    <Ionicons name="trophy" size={20} color={appColors.warning} />
                    <Text style={styles.confirmInfoText}>
                      {t('projectdetail.s_67')}</Text>
                  </View>
                  <View style={styles.confirmInfoRow}>
                    <Ionicons name="people" size={20} color={appColors.primary} />
                    <Text style={styles.confirmInfoText}>
                      {t('projectdetail.s_68')}</Text>
                  </View>
                </View>
                
                <View style={styles.confirmButtons}>
                  <TouchableOpacity
                    style={[styles.confirmButton, styles.confirmButtonCancel]}
                    onPress={() => setShowJoinConfirm(false)}
                  >
                    <Text 
                      style={styles.confirmButtonCancelText}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                    >{t('projectdetail.s_69')}</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[styles.confirmButton, styles.confirmButtonJoin]}
                    onPress={() => {
                      setShowJoinConfirm(false);
                      confirmJoin();
                    }}
                    disabled={joining}
                  >
                    {joining ? (
                      <ActivityIndicator size="small" color={appColors.white} />
                    ) : (
                      <>
                        <Ionicons name="checkmark-circle" size={18} color={appColors.white} />
                        <Text 
                          style={styles.confirmButtonJoinText}
                          numberOfLines={1}
                          adjustsFontSizeToFit
                        >{t('projectdetail.s_70')}</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Leave Reason Modal */}
      <Modal
        visible={showLeaveReasonModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          setShowLeaveReasonModal(false);
          setLeaveReason('');
        }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardAvoidingView}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => {
              setShowLeaveReasonModal(false);
              setLeaveReason('');
            }}
          >
            <TouchableOpacity
              activeOpacity={1}
              onPress={(e) => e.stopPropagation()}
              style={styles.leaveReasonModalContent}
            >
              <View style={styles.modalHandle} />
              
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{t('projectdetail.s_71')}</Text>
                <TouchableOpacity 
                  onPress={() => {
                    setShowLeaveReasonModal(false);
                    setLeaveReason('');
                  }}
                  style={styles.modalCloseButton}
                >
                  <Ionicons name="close" size={24} color={appColors.textMuted} />
                </TouchableOpacity>
              </View>
              
              <ScrollView 
                style={styles.leaveModalScrollView}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                <Text style={styles.leaveModalLabel}>
                  {t('projectdetail.s_72')}</Text>
                
                <TextInput
                  style={styles.leaveReasonInput}
                  placeholder={t('projectdetail.s_73')}
                  placeholderTextColor={appColors.textSoft}
                  value={leaveReason}
                  onChangeText={setLeaveReason}
                  multiline
                  numberOfLines={6}
                  textAlignVertical="top"
                  maxLength={500}
                  autoFocus
                />
                
                <Text style={styles.charCounter}>
                  {leaveReason.length}/500
                </Text>
                
                <View style={styles.leaveModalButtons}>
                  <TouchableOpacity
                    style={[styles.leaveModalButton, styles.leaveModalButtonCancel]}
                    onPress={() => {
                      setShowLeaveReasonModal(false);
                      setLeaveReason('');
                    }}
                  >
                    <Text 
                      style={styles.leaveModalButtonCancelText}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                    >{t('projectdetail.s_74')}</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[
                      styles.leaveModalButton,
                      styles.leaveModalButtonConfirm,
                      (!leaveReason.trim() || leaving) && styles.buttonDisabled,
                    ]}
                    onPress={confirmLeave}
                    disabled={!leaveReason.trim() || leaving}
                  >
                    {leaving ? (
                      <ActivityIndicator size="small" color={appColors.white} />
                    ) : (
                      <Text 
                        style={styles.leaveModalButtonConfirmText}
                        numberOfLines={1}
                        adjustsFontSizeToFit
                      >{t('projectdetail.s_75')}</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </TouchableOpacity>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>

      {/* Join/Leave Button */}
      <View style={styles.bottomContainer}>
        {Boolean(project && project.joined) ? (
          <TouchableOpacity
            style={[styles.leaveButton, leaving && styles.joinButtonDisabled]}
            onPress={handleLeave}
            disabled={leaving}
            activeOpacity={0.8}
          >
            {leaving ? (
              <ActivityIndicator size="small" color={appColors.danger} />
            ) : (
              <Text style={styles.leaveButtonText}>{t('projectdetail.s_76')}</Text>
            )}
          </TouchableOpacity>
        ) : (
          <Animated.View
            style={{
              transform: [
                {
                  scale: isButtonPressed ? buttonScale : buttonPulse,
                },
              ],
            }}
          >
            <TouchableOpacity
              style={[
                styles.joinButton,
                joining && styles.joinButtonDisabled,
              ]}
              onPress={handleJoin}
              disabled={joining}
              activeOpacity={0.8}
            >
              {joining ? (
                <ActivityIndicator size="small" color={appColors.white} />
              ) : (
                <Text style={styles.joinButtonText}>{t('projectdetail.s_77')}</Text>
              )}
            </TouchableOpacity>
          </Animated.View>
        )}
      </View>
      
      {/* Join Success Modal */}
      <Modal
        visible={showJoinSuccess}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowJoinSuccess(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalKeyboardView}
        >
          <View style={styles.successModalOverlay}>
            <ScrollView
              contentContainerStyle={styles.successModalScrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <View style={[styles.successModalContent, { maxHeight: '80%' }]}>
                <View style={styles.successIconContainer}>
                  <View style={styles.successIconCircle}>
                    <Ionicons name="checkmark-circle" size={64} color={appColors.primary} />
                  </View>
                </View>
                
                <Text style={styles.successTitle}>{t('projectdetail.s_78')}</Text>
                <Text style={styles.successMessage}>
                  {t('projectdetail.s_79')}</Text>
                <Text style={styles.successProjectName}>
                  "{project?.title}"
                </Text>
                
                <View style={styles.successInfoBox}>
                  <View style={styles.successInfoRow}>
                    <Ionicons name="people" size={20} color={appColors.primary} />
                    <Text style={styles.successInfoText}>
                      {t('projectdetail.s_80')}</Text>
                  </View>
                  <View style={styles.successInfoRow}>
                    <Ionicons name="trophy" size={20} color={appColors.warning} />
                    <Text style={styles.successInfoText}>
                      {t('projectdetail.s_81')}</Text>
                  </View>
                </View>
                
                <TouchableOpacity
                  style={styles.successButton}
                  onPress={() => setShowJoinSuccess(false)}
                >
                  <Text style={styles.successButtonText}>{t('projectdetail.s_82')}</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
      
      {/* Leave Success Modal */}
      <Modal
        visible={showLeaveSuccess}
        animationType="fade"
        transparent={true}
        onRequestClose={() => {
          setShowLeaveSuccess(false);
          navigation.goBack();
        }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalKeyboardView}
        >
          <View style={styles.successModalOverlay}>
            <ScrollView
              contentContainerStyle={styles.successModalScrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <View style={[styles.successModalContent, { maxHeight: '80%' }]}>
                <View style={styles.leaveSuccessIconContainer}>
                  <View style={styles.leaveSuccessIconCircle}>
                    <Ionicons name="exit-outline" size={64} color={appColors.danger} />
                  </View>
                </View>
                
                <Text style={styles.successTitle}>{t('projectdetail.s_83')}</Text>
                <Text style={styles.successProjectName}>
                  "{project?.title}"
                </Text>
                
                {leaveSuccessData?.penaltyApplied && leaveSuccessData?.trustFactor !== undefined && (
                  <View style={styles.penaltyInfoBox}>
                    <View style={styles.penaltyHeader}>
                      <Ionicons name="alert-circle" size={24} color={appColors.danger} />
                      <Text style={styles.penaltyTitle}>{t('projectdetail.s_84')}</Text>
                    </View>
                    
                    <View style={styles.tfChangeRow}>
                      <View style={styles.tfChangeBox}>
                        <Text 
                          style={styles.tfChangeLabel}
                          numberOfLines={1}
                          adjustsFontSizeToFit
                        >Trust Factor</Text>
                        <Text style={styles.tfChangeValue}>{leaveSuccessData.trustFactor + 5}</Text>
                      </View>
                      
                      <Ionicons name="arrow-forward" size={16} color={appColors.textSoft} />
                      
                      <View style={styles.tfChangeBox}>
                        <Text 
                          style={styles.tfChangeLabel}
                          numberOfLines={1}
                          adjustsFontSizeToFit
                        >{t('projectdetail.s_85')}</Text>
                        <Text style={[styles.tfChangeValue, styles.tfChangeValueDanger]}>
                          {leaveSuccessData.trustFactor}
                        </Text>
                      </View>
                    </View>
                    
                    <View style={styles.penaltyNote}>
                      <Text style={styles.penaltyNoteText}>
                        {t('projectdetail.s_86')}</Text>
                    </View>
                  </View>
                )}
                
                <TouchableOpacity
                  style={styles.leaveSuccessButton}
                  onPress={() => {
                    setShowLeaveSuccess(false);
                    navigation.goBack();
                  }}
                >
                  <Text style={styles.leaveSuccessButtonText}>{t('projectdetail.s_87')}</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: appColors.surface,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: appColors.surface,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: appColors.surface,
    padding: 24,
  },
  errorText: {
    fontSize: 16,
    color: appColors.textSoft,
    marginTop: 16,
    marginBottom: 24,
  },
  backButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: appColors.primary,
    borderRadius: 12,
  },
  backButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: appColors.white,
  },
  scrollView: {
    flex: 1,
  },
  imageContainer: {
    position: 'relative',
    height: 300,
  },
  projectImageContainer: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  projectImage: {
    width: '100%',
    height: '100%',
    backgroundColor: appColors.surfaceMuted,
  },
  imageHidden: {
    opacity: 0,
  },
  imagePlaceholder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  backButtonOverlay: {
    position: 'absolute',
    top: 50,
    left: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: appColors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  shareButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: appColors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  content: {
    padding: 20,
  },
  categoryBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 14,
    marginBottom: 16,
  },
  categoryText: {
    fontSize: 11,
    fontWeight: '700',
    color: appColors.white,
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: appColors.text,
    marginBottom: 20,
    lineHeight: 32,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderColor: appColors.border,
  },
  infoRowCenter: {
    alignItems: 'center',
  },
  infoIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: appColors.primarySurface,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: appColors.text,
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 13,
    color: appColors.textMuted,
  },
  mapButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: appColors.primarySurface,
    borderRadius: 12,
  },
  mapButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: appColors.primary,
  },
  organizerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderColor: appColors.border,
  },
  organizerAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: appColors.primarySurface,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  organizerContent: {
    flex: 1,
  },
  organizerName: {
    fontSize: 15,
    fontWeight: '600',
    color: appColors.text,
    marginBottom: 4,
  },
  organizerOrganization: {
    fontSize: 13,
    color: appColors.primary,
    fontWeight: '500',
  },
  organizerType: {
    fontSize: 13,
    color: appColors.textMuted,
    fontWeight: '400',
  },
  organizerMoreButton: {
    fontSize: 13,
    fontWeight: '600',
    color: appColors.primary,
  },
  section: {
    marginTop: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: appColors.text,
  },
  participantsCount: {
    fontSize: 14,
    color: appColors.textMuted,
    fontWeight: '500',
  },
  description: {
    fontSize: 14,
    color: appColors.textMuted,
    lineHeight: 22,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 12,
    gap: 8,
  },
  tag: {
    backgroundColor: appColors.surfaceSoft,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  tagText: {
    fontSize: 12,
    fontWeight: '500',
    color: appColors.textMuted,
  },
  participantsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarsContainer: {
    flexDirection: 'row',
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: appColors.surfaceMuted,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: appColors.surfaceMuted,
  },
  showAllButton: {
    marginLeft: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: appColors.primarySurface,
    borderRadius: 12,
  },
  showAllButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: appColors.primary,
  },
  showAllLink: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingVertical: 8,
  },
  showAllLinkText: {
    fontSize: 14,
    fontWeight: '600',
    color: appColors.primary,
    marginRight: 4,
  },
  noParticipants: {
    fontSize: 13,
    color: appColors.textSoft,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: appColors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    paddingBottom: Platform.OS === 'ios' ? 40 : 30,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderColor: appColors.border,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: appColors.text,
  },
  modalCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: appColors.surfaceSoft,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalScrollView: {
    maxHeight: '60%',
  },
  participantItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderColor: appColors.border,
  },
  participantAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: appColors.surfaceMuted,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    overflow: 'hidden',
  },
  participantAvatarImage: {
    width: '100%',
    height: '100%',
  },
  participantAvatarPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: appColors.surfaceMuted,
  },
  participantInfo: {
    flex: 1,
  },
  participantName: {
    fontSize: 15,
    fontWeight: '600',
    color: appColors.text,
    marginBottom: 4,
  },
  participantDate: {
    fontSize: 13,
    color: appColors.textMuted,
  },
  noParticipantsModal: {
    fontSize: 14,
    color: appColors.textSoft,
    textAlign: 'center',
    padding: 40,
  },
  contactsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  contactButton: {},
  contactIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: appColors.primarySurface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  spacer: {
    height: 100,
  },
  bottomContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    paddingBottom: 30,
    backgroundColor: appColors.surface,
    borderTopWidth: 1,
    borderColor: appColors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 5,
  },
  joinButton: {
    backgroundColor: appColors.primary,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: appColors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  joinButtonDisabled: {
    opacity: 0.6,
  },
  joinButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: appColors.white,
  },
  leaveButton: {
    backgroundColor: appColors.surface,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: appColors.danger,
    width: '100%',
  },
  leaveButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: appColors.danger,
  },
  // Warning Modal Styles
  modalKeyboardView: {
    flex: 1,
  },
  warningModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  warningModalScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
  },
  warningModalContent: {
    backgroundColor: appColors.surface,
    borderRadius: 24,
    padding: 20,
    width: '94%',
    maxWidth: '94%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 10,
  },
  warningModalContentCompact: {
    width: '100%',
    maxWidth: 380,
    padding: 16,
    borderRadius: 22,
  },
  warningModalCloseButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: appColors.surfaceSoft,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  warningIconContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  warningIconContainerCompact: {
    marginBottom: 14,
    marginTop: 8,
  },
  warningIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: appColors.dangerSurface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  warningTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: appColors.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  warningTitleCompact: {
    fontSize: 19,
    lineHeight: 26,
    paddingHorizontal: 28,
  },
  warningSubtitle: {
    fontSize: 14,
    color: appColors.textMuted,
    textAlign: 'center',
    marginBottom: 24,
    fontStyle: 'italic',
  },
  warningSubtitleCompact: {
    fontSize: 13,
    marginBottom: 18,
  },
  warningInfoBox: {
    backgroundColor: appColors.dangerSurface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#7F1D1D',
    width: '100%',
  },
  warningInfoBoxCompact: {
    padding: 14,
    marginBottom: 18,
  },
  warningInfoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  warningInfoText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#DC2626',
    marginLeft: 12,
    lineHeight: 20,
  },
  warningInfoTextCompact: {
    fontSize: 13,
    marginLeft: 10,
    lineHeight: 18,
  },
  tfChangeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 8,
  },
  tfBox: {
    flex: 1,
    backgroundColor: appColors.surface,
    borderRadius: 12,
    padding: 8,
    alignItems: 'center',
    minWidth: 0,
  },
  tfLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: appColors.textMuted,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  tfValue: {
    fontSize: 22,
    fontWeight: '800',
    color: appColors.primary,
  },
  tfValueDanger: {
    color: appColors.danger,
  },
  dangerNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: appColors.surface,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#7F1D1D',
  },
  dangerNoticeText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: '#DC2626',
    marginLeft: 8,
    lineHeight: 18,
  },
  dangerNoticeTextCompact: {
    fontSize: 12,
    lineHeight: 17,
  },
  warningButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  warningButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  warningButtonCancel: {
    backgroundColor: appColors.surfaceSoft,
  },
  warningButtonCancelText: {
    fontSize: 16,
    fontWeight: '700',
    color: appColors.textMuted,
  },
  warningButtonContinue: {
    backgroundColor: appColors.danger,
  },
  warningButtonContinueText: {
    fontSize: 16,
    fontWeight: '700',
    color: appColors.white,
    paddingHorizontal: 4,
  },
  // Join Confirmation Modal Styles
  confirmModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  confirmModalScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
  },
  confirmModalContent: {
    backgroundColor: appColors.surface,
    borderRadius: 24,
    padding: 20,
    width: '94%',
    maxWidth: '94%',
    maxHeight: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 10,
  },
  confirmIconContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  confirmIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: appColors.primarySurface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmTitle: {
    fontSize: Platform.OS === 'ios' ? 22 : 20,
    fontWeight: '800',
    color: appColors.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  confirmProjectName: {
    fontSize: Platform.OS === 'ios' ? 15 : 14,
    fontWeight: '600',
    color: appColors.primary,
    textAlign: 'center',
    marginBottom: 20,
    fontStyle: 'italic',
    paddingHorizontal: 8,
  },
  confirmInfoBox: {
    backgroundColor: appColors.background,
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    width: '100%',
  },
  confirmInfoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  confirmInfoText: {
    flex: 1,
    fontSize: 14,
    color: appColors.textMuted,
    marginLeft: 12,
    lineHeight: 20,
  },
  confirmButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  confirmButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmButtonCancel: {
    backgroundColor: appColors.surfaceSoft,
  },
  confirmButtonCancelText: {
    fontSize: 16,
    fontWeight: '700',
    color: appColors.textMuted,
  },
  confirmButtonJoin: {
    backgroundColor: appColors.primary,
    flexDirection: 'row',
    gap: 6,
  },
  confirmButtonJoinText: {
    fontSize: 15,
    fontWeight: '700',
    color: appColors.white,
    flexShrink: 1,
  },
  // Leave Reason Modal Styles
  keyboardAvoidingView: {
    flex: 1,
  },
  leaveReasonModalContent: {
    backgroundColor: appColors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    width: '100%',
    maxWidth: '100%',
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: appColors.surfaceMuted,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  leaveModalScrollView: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  leaveModalLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: appColors.text,
    marginBottom: 12,
    marginTop: 8,
  },
  leaveReasonInput: {
    borderWidth: 1,
    borderColor: appColors.border,
    borderRadius: 16,
    padding: 16,
    fontSize: 15,
    color: appColors.text,
    backgroundColor: appColors.background,
    minHeight: 140,
    marginBottom: 8,
  },
  charCounter: {
    fontSize: 12,
    color: appColors.textSoft,
    textAlign: 'right',
    marginBottom: 20,
  },
  leaveModalButtons: {
    flexDirection: 'row',
    gap: 12,
    paddingBottom: 20,
  },
  leaveModalButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  leaveModalButtonCancel: {
    backgroundColor: appColors.surfaceSoft,
  },
  leaveModalButtonCancelText: {
    fontSize: 16,
    fontWeight: '700',
    color: appColors.textMuted,
  },
  leaveModalButtonConfirm: {
    backgroundColor: appColors.danger,
  },
  leaveModalButtonConfirmText: {
    fontSize: 16,
    fontWeight: '700',
    color: appColors.white,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  // Success Modals Styles
  successModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  successModalScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
  },
  successModalContent: {
    backgroundColor: appColors.surface,
    borderRadius: 24,
    padding: 32,
    width: '90%',
    maxWidth: '90%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 10,
  },
  successIconContainer: {
    marginBottom: 24,
  },
  successIconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: appColors.primarySurface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  leaveSuccessIconContainer: {
    marginBottom: 24,
  },
  leaveSuccessIconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: appColors.dangerSurface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  successTitle: {
    fontSize: Platform.OS === 'ios' ? 24 : 22,
    fontWeight: '800',
    color: appColors.text,
    textAlign: 'center',
    marginBottom: 12,
  },
  successMessage: {
    fontSize: Platform.OS === 'ios' ? 16 : 15,
    color: appColors.textMuted,
    textAlign: 'center',
    marginBottom: 8,
    lineHeight: 24,
    paddingHorizontal: 8,
  },
  successProjectName: {
    fontSize: Platform.OS === 'ios' ? 15 : 14,
    fontWeight: '600',
    color: appColors.primary,
    textAlign: 'center',
    marginBottom: 24,
    fontStyle: 'italic',
    paddingHorizontal: 8,
  },
  successInfoBox: {
    backgroundColor: appColors.background,
    borderRadius: 16,
    padding: 16,
    width: '100%',
    marginBottom: 24,
    minWidth: '100%',
  },
  successInfoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  successInfoText: {
    flex: 1,
    fontSize: 14,
    color: appColors.textMuted,
    marginLeft: 12,
    lineHeight: 20,
  },
  successButton: {
    backgroundColor: appColors.primary,
    paddingVertical: 16,
    paddingHorizontal: 48,
    borderRadius: 16,
    width: '100%',
    alignItems: 'center',
    shadowColor: appColors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  successButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: appColors.white,
  },
  leaveSuccessButton: {
    backgroundColor: appColors.danger,
    paddingVertical: 16,
    paddingHorizontal: 48,
    borderRadius: 16,
    width: '100%',
    alignItems: 'center',
    shadowColor: appColors.danger,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  leaveSuccessButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: appColors.white,
  },
  penaltyInfoBox: {
    backgroundColor: appColors.dangerSurface,
    borderRadius: 16,
    padding: 16,
    width: '100%',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#7F1D1D',
  },
  penaltyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    justifyContent: 'center',
  },
  penaltyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#DC2626',
    marginLeft: 8,
  },
  tfChangeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 8,
  },
  tfChangeBox: {
    flex: 1,
    backgroundColor: appColors.surface,
    borderRadius: 12,
    padding: 8,
    alignItems: 'center',
    minWidth: 0,
  },
  tfChangeLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: appColors.textMuted,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tfChangeValue: {
    fontSize: 22,
    fontWeight: '800',
    color: appColors.primary,
  },
  tfChangeValueDanger: {
    color: appColors.danger,
  },
  penaltyNote: {
    backgroundColor: appColors.surface,
    borderRadius: 8,
    padding: 8,
    alignItems: 'center',
  },
  penaltyNoteText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#DC2626',
  },
});
