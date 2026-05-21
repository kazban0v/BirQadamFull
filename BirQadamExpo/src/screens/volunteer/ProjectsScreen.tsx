import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  RefreshControl,
  TextInput,
  FlatList,
  Dimensions,
  Animated,
  Alert,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useToast } from '../../components/Toast';
import { Ionicons } from '@expo/vector-icons';
import { volunteerAPI } from '../../services/api';
import { LeaveProjectReasonModal } from '../../components/projects/LeaveProjectReasonModal';
import type { Project } from '../../types';
import { normalizeImageUrl } from '../../utils/network';
import { getAxiosErrorMessage, getAxiosErrorResponse } from '../../utils/apiErrorMessage';
import { isProjectCurrentlyActive } from '../../utils/projectUtils';
import { appColors, getProjectTypeVisual, appMotion } from '../../theme';
import { hapticSuccess } from '../../utils/haptics';
import { EmptyState } from '../../components/EmptyState';
import { useTranslation } from '../../locales/i18n';
import { SkeletonProjects } from '../../components/skeleton/screens/SkeletonProjects';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = (SCREEN_WIDTH - 48) / 2;

type ViewMode = 'grid' | 'list';
type StatusFilter = 'all' | 'joined' | 'available';
type TypeFilter = 'all' | 'social' | 'environmental' | 'cultural';

interface VolunteerProjectsScreenProps {
  navigation: any;
}

interface ProjectsResponse {
  projects: Project[];
  summary: { total_available: number; joined_count: number };
  message?: string;
}

// ─────────────────────────────────────────────────
// Animated card wrapper (staggered fade-in)
// ─────────────────────────────────────────────────
const CardWrapper: React.FC<{ index: number; children: React.ReactNode }> = ({ index, children }) => {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(14)).current;

  useEffect(() => {
    const d = appMotion.duration.normal;
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: d,
        delay: (index % 8) * 55,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: d,
        delay: (index % 8) * 55,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <Animated.View
      style={{
        opacity,
        transform: [{ translateY }],
        width: CARD_WIDTH,
        alignSelf: 'stretch',
      }}
    >
      {children}
    </Animated.View>
  );
};

// ─────────────────────────────────────────────────
// Main Screen
// ─────────────────────────────────────────────────
// Русское склонение: 1 проект / 2-4 проекта / 5 проектов
const pluralizeRu = (n: number, one: string, few: string, many: string): string => {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
  return many;
};

export const VolunteerProjectsScreen: React.FC<VolunteerProjectsScreenProps> = ({ navigation }) => {
  const { t } = useTranslation();
  const toast = useToast();
  const insets = useSafeAreaInsets();

  const [projects, setProjects] = useState<Project[]>([]);
  const [filtered, setFiltered] = useState<Project[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [trustFactor, setTrustFactor] = useState<number | null>(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');

  const [leaveProject, setLeaveProject] = useState<Project | null>(null);
  const [leaveReason, setLeaveReason] = useState('');
  const [leaving, setLeaving] = useState(false);

  // Animated header
  const scrollY = useRef(new Animated.Value(0)).current;
  const headerHeight = scrollY.interpolate({
    inputRange: [0, 60],
    outputRange: [64, 52],
    extrapolate: 'clamp',
  });
  const titleFontSize = scrollY.interpolate({
    inputRange: [0, 60],
    outputRange: [24, 18],
    extrapolate: 'clamp',
  });

  // ── Load ──────────────────────────────────────
  const loadProjects = async (showSkeleton: boolean = false) => {
    if (showSkeleton) setLoading(true);
    try {
      const [projectsRes, profileRes] = await Promise.all([
        volunteerAPI.getProjects(),
        volunteerAPI.getProfile(),
      ]);
      const data: ProjectsResponse = projectsRes.data;
      setProjects(data.projects || []);
      setTrustFactor(profileRes.data?.trust_factor ?? 0);
    } catch (error: unknown) {
      toast.error(getAxiosErrorMessage(error, t('projects.s_0')));
    } finally {
      if (showSkeleton) setLoading(false);
    }
  };

  useEffect(() => { loadProjects(true); }, []);

  // ── Filter ────────────────────────────────────
  useEffect(() => {
    let result = projects.filter(isProjectCurrentlyActive);

    if (statusFilter === 'joined')    result = result.filter((p) => p.joined);
    if (statusFilter === 'available') result = result.filter((p) => !p.joined);
    if (typeFilter !== 'all')         result = result.filter((p) => p.volunteer_type === typeFilter);

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (p) => p.title.toLowerCase().includes(q) || (p.city || '').toLowerCase().includes(q)
      );
    }

    setFiltered(result);
  }, [projects, statusFilter, typeFilter, search]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadProjects();
    setRefreshing(false);
  };

  // ── Join / Leave ──────────────────────────────
  const handleJoin = (projectId: number) => {
    if (trustFactor !== null && trustFactor <= 0) {
      toast.warning(t('projects.s_3'));
      return;
    }
    Alert.alert(t('projects.s_4'), t('projects.s_5'), [
      { text: t('projects.s_6'), style: 'cancel' },
      { text: t('projects.s_7'), onPress: () => confirmJoin(projectId) },
    ]);
  };

  const confirmJoin = async (projectId: number) => {
    try {
      const response = await volunteerAPI.joinProject(projectId);
      hapticSuccess();
      toast.success(response.data.message || t('projects.s_9'));
      await loadProjects();
    } catch (error: unknown) {
      const errorMessage = getAxiosErrorMessage(error, t('projects.s_10'));
      const res = getAxiosErrorResponse(error);
      if ((res?.status === 403 || res?.status === 400) && res.data?.trust_factor !== undefined) {
        toast.error(`Trust Factor: ${String(res.data.trust_factor)}. ${errorMessage}`);
      } else {
        toast.error(errorMessage);
      }
    }
  };

  const handleLeave = (project: Project) => {
    setLeaveProject(project);
    setLeaveReason('');
  };

  const confirmLeave = async () => {
    if (!leaveProject) return;
    const trimmedReason = leaveReason.trim();
    if (!trimmedReason) { toast.warning(t('projects.s_15')); return; }

    setLeaving(true);
    try {
      const response = await volunteerAPI.leaveProject(leaveProject.id, trimmedReason);
      const result = response.data;
      if (result.trust_factor !== undefined) setTrustFactor(result.trust_factor);

      let message = result.message || t('projects.s_16');
      if (result.penalty_applied && result.trust_factor !== undefined) {
        message += ` Trust Factor: ${result.trust_factor} (-5 TF)`;
      }

      setLeaveProject(null);
      setLeaveReason('');
      result.penalty_applied ? toast.warning(message) : toast.success(message);
      await loadProjects();
    } catch (error: unknown) {
      toast.error(getAxiosErrorMessage(error, t('projects.s_19')));
    } finally {
      setLeaving(false);
    }
  };

  // ── Type label helper ─────────────────────────
  const getTypeLabel = (type: string): string => {
    switch (type) {
      case 'social':        return t('projects.s_34');
      case 'environmental': return t('projects.s_35');
      case 'cultural':      return t('projects.s_36');
      default:              return type;
    }
  };

  // ─────────────────────────────────────────────
  // GRID card
  // ─────────────────────────────────────────────
  const GridCard = useCallback(({ project, index }: { project: Project; index: number }) => {
    const { color, icon } = getProjectTypeVisual(project.volunteer_type);
    const imageUrl = normalizeImageUrl(project.cover_image_url);

    return (
      <CardWrapper index={index}>
        <TouchableOpacity
          style={styles.gridCard}
          activeOpacity={0.87}
          onPress={() => navigation.navigate('VolunteerProjectDetail', { projectId: project.id })}
        >
          {/* Image */}
          <View style={styles.gridImageWrap}>
            {imageUrl ? (
              <Image source={{ uri: imageUrl }} style={styles.gridImage} resizeMode="cover" />
            ) : (
              <View style={[styles.gridImage, styles.placeholder]}>
                <Ionicons name="leaf" size={34} color={appColors.primary} />
              </View>
            )}
            {/* Joined overlay */}
            {project.joined && (
              <View style={styles.joinedOverlay}>
                <Ionicons name="checkmark-circle" size={16} color="#fff" />
              </View>
            )}
            {/* Type dot */}
            <View style={[styles.typeDot, { backgroundColor: color }]}>
              <Ionicons name={icon} size={9} color="#fff" />
            </View>
          </View>

          {/* Body */}
          <View style={styles.gridBody}>
            <Text style={styles.gridTitle} numberOfLines={2}>{project.title}</Text>

            {!!project.city && (
              <View style={styles.metaRow}>
                <Ionicons name="location" size={11} color={appColors.textMuted} />
                <Text style={styles.metaText} numberOfLines={1}>{project.city}</Text>
              </View>
            )}

            <View style={styles.statsRow}>
              <View style={styles.stat}>
                <View style={styles.statIconWrap}>
                  <Ionicons name="people-outline" size={12} color={appColors.primary} />
                </View>
                <Text
                  style={styles.statText}
                  includeFontPadding={Platform.OS === 'android' ? false : undefined}
                >
                  {project.active_members || 0}
                </Text>
              </View>
              <View style={styles.stat}>
                <View style={styles.statIconWrap}>
                  <Ionicons name="flag-outline" size={12} color={appColors.warning} />
                </View>
                <Text
                  style={styles.statText}
                  includeFontPadding={Platform.OS === 'android' ? false : undefined}
                >
                  {project.tasks_count || 0}
                </Text>
              </View>
            </View>
          </View>

          {/* Action button */}
          <TouchableOpacity
            style={[
              styles.gridActionBtn,
              project.joined ? styles.gridActionBtnJoined : styles.gridActionBtnJoin,
            ]}
            activeOpacity={0.8}
            onPress={(e) => {
              e.stopPropagation();
              project.joined ? handleLeave(project) : handleJoin(project.id);
            }}
          >
            <Ionicons
              name={project.joined ? 'exit-outline' : 'add'}
              size={13}
              color={project.joined ? appColors.danger : '#fff'}
            />
            <Text
              style={[
                styles.gridActionText,
                project.joined ? styles.gridActionTextJoined : styles.gridActionTextJoin,
              ]}
            >
              {project.joined ? t('projects.s_27') : t('projects.s_28')}
            </Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </CardWrapper>
    );
  }, [navigation, t, trustFactor]);

  // ─────────────────────────────────────────────
  // LIST card
  // ─────────────────────────────────────────────
  const ListCard = useCallback(({ project, index }: { project: Project; index: number }) => {
    const { color, icon } = getProjectTypeVisual(project.volunteer_type);
    const imageUrl = normalizeImageUrl(project.cover_image_url);

    return (
      <CardWrapper index={index}>
        <TouchableOpacity
          style={styles.listCard}
          activeOpacity={0.87}
          onPress={() => navigation.navigate('VolunteerProjectDetail', { projectId: project.id })}
        >
          {/* Thumbnail */}
          <View style={styles.listThumbWrap}>
            {imageUrl ? (
              <Image source={{ uri: imageUrl }} style={styles.listThumb} resizeMode="cover" />
            ) : (
              <View style={[styles.listThumb, styles.placeholder]}>
                <Ionicons name="leaf" size={28} color={appColors.primary} />
              </View>
            )}
            {project.joined && (
              <View style={styles.listJoinedDot}>
                <Ionicons name="checkmark" size={10} color="#fff" />
              </View>
            )}
          </View>

          {/* Body */}
          <View style={styles.listBody}>
            {/* Type pill */}
            <View style={[styles.typePill, { backgroundColor: color }]}>
              <Ionicons name={icon} size={10} color="#fff" />
              <Text style={styles.typePillText}>{getTypeLabel(project.volunteer_type)}</Text>
            </View>

            <Text style={styles.listTitle} numberOfLines={2}>{project.title}</Text>

            {!!project.city && (
              <View style={styles.metaRow}>
                <Ionicons name="location" size={11} color={appColors.textMuted} />
                <Text style={styles.metaText} numberOfLines={1}>{project.city}</Text>
              </View>
            )}

            <View style={styles.statsRow}>
              <View style={styles.stat}>
                <View style={styles.statIconWrapList}>
                  <Ionicons name="people-outline" size={12} color={appColors.primary} />
                </View>
                <Text
                  style={styles.statTextList}
                  includeFontPadding={Platform.OS === 'android' ? false : undefined}
                >
                  {project.active_members || 0}{' '}
                  {pluralizeRu(project.active_members || 0, t('projects.s_42'), t('projects.s_43'), t('projects.s_44'))}
                </Text>
              </View>
              <View style={styles.stat}>
                <View style={styles.statIconWrapList}>
                  <Ionicons name="flag-outline" size={12} color={appColors.warning} />
                </View>
                <Text
                  style={styles.statTextList}
                  includeFontPadding={Platform.OS === 'android' ? false : undefined}
                >
                  {project.tasks_count || 0}{' '}
                  {pluralizeRu(project.tasks_count || 0, t('projects.s_45'), t('projects.s_46'), t('projects.s_47'))}
                </Text>
              </View>
            </View>
          </View>

          {/* Action icon */}
          <TouchableOpacity
            style={[
              styles.listActionBtn,
              project.joined ? styles.listActionBtnJoined : styles.listActionBtnJoin,
            ]}
            activeOpacity={0.8}
            onPress={(e) => {
              e.stopPropagation();
              project.joined ? handleLeave(project) : handleJoin(project.id);
            }}
          >
            <Ionicons
              name={project.joined ? 'exit-outline' : 'add'}
              size={18}
              color={project.joined ? appColors.danger : appColors.primary}
            />
          </TouchableOpacity>
        </TouchableOpacity>
      </CardWrapper>
    );
  }, [navigation, t, trustFactor]);

  // ─────────────────────────────────────────────
  // Filter chips
  // ─────────────────────────────────────────────
  function StatusChip({ id, label }: { id: StatusFilter; label: string }) {
    const active = statusFilter === id;
    return (
      <TouchableOpacity
        style={[styles.chip, active && styles.chipActive]}
        onPress={() => setStatusFilter(id)}
        activeOpacity={0.75}
      >
        <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
      </TouchableOpacity>
    );
  }

  function TypeChip({ id, label, icon }: { id: TypeFilter; label: string; icon: keyof typeof Ionicons.glyphMap }) {
    const active = typeFilter === id;
    return (
      <TouchableOpacity
        style={[styles.chip, active && styles.chipActive]}
        onPress={() => setTypeFilter(id)}
        activeOpacity={0.75}
      >
        <Ionicons name={icon} size={12} color={active ? '#fff' : appColors.textMuted} />
        <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
      </TouchableOpacity>
    );
  }

  // ─────────────────────────────────────────────
  // Trust Factor banner
  // ─────────────────────────────────────────────
  const showTFBanner = trustFactor !== null && trustFactor <= 0;

  // ─────────────────────────────────────────────
  // Loading
  // ─────────────────────────────────────────────
  if (loading) return <SkeletonProjects mode="all" viewMode={viewMode} />;

  const isEmpty = filtered.length === 0;
  const hasActiveFilters = statusFilter !== 'all' || typeFilter !== 'all' || search.trim().length > 0;
  const resetFilters = () => {
    setStatusFilter('all');
    setTypeFilter('all');
    setSearch('');
  };

  // ─────────────────────────────────────────────
  // Counts for header subtitle
  // ─────────────────────────────────────────────

  return (
    <View style={styles.root}>

      {/* ── Sticky animated header ── */}
      <Animated.View style={[styles.stickyHeader, { height: headerHeight }]}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1, minWidth: 0, paddingRight: 12 }}>
            <Animated.Text style={[styles.headerTitle, { fontSize: titleFontSize }]} numberOfLines={1}>
              {t('projects.s_29')}
            </Animated.Text>
          </View>
          {/* View mode */}
          <View style={styles.viewToggle}>
            <TouchableOpacity
              style={[styles.viewBtn, viewMode === 'grid' && styles.viewBtnActive]}
              onPress={() => setViewMode('grid')}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityRole="button"
            >
              <Ionicons name="grid" size={16} color={viewMode === 'grid' ? appColors.primary : appColors.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.viewBtn, viewMode === 'list' && styles.viewBtnActive]}
              onPress={() => setViewMode('list')}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityRole="button"
            >
              <Ionicons name="list" size={18} color={viewMode === 'list' ? appColors.primary : appColors.textMuted} />
            </TouchableOpacity>
          </View>
        </View>
      </Animated.View>

      {/* ── Trust Factor warning banner ── */}
      {showTFBanner && (
        <View style={styles.tfBanner}>
          <Ionicons name="warning" size={15} color={appColors.bannerWarningText} />
          <Text style={styles.tfBannerText}>{t('projects.s_3')}</Text>
        </View>
      )}

      {/* ── Search ── */}
      <View style={styles.searchWrap}>
        <Ionicons name="search" size={16} color={appColors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder={`${t('projects.s_48')}...`}
          placeholderTextColor={appColors.textMuted}
          value={search}
          onChangeText={setSearch}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close-circle" size={16} color={appColors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {/* ── Status filter row ── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={[styles.filterRow, { paddingRight: 16 }]}
      >
        <StatusChip id="all"       label={t('projects.s_30')} />
        <StatusChip id="joined"    label={t('projects.s_31')} />
        <StatusChip id="available" label={t('projects.s_32')} />
      </ScrollView>

      {/* ── Type filter row ── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={[styles.filterRow, { paddingRight: 16 }]}
      >
        <TypeChip id="all"           label={t('projects.s_33')} icon="apps" />
        <TypeChip id="social"        label={t('projects.s_34')} icon="people" />
        <TypeChip id="environmental" label={t('projects.s_35')} icon="leaf" />
        <TypeChip id="cultural"      label={t('projects.s_36')} icon="color-palette" />
      </ScrollView>

      {/* ── Result count ── */}
      {!isEmpty && (
        <Text style={styles.resultCount}>
          {filtered.length} {pluralizeRu(
            filtered.length,
            t('projects.s_38'),
            t('projects.s_39'),
            t('projects.s_40'),
          )}
        </Text>
      )}

      {/* ── Content ── */}
      {isEmpty ? (
        <ScrollView
          style={styles.listBg}
          contentContainerStyle={styles.emptyWrap}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={appColors.primary} colors={[appColors.primary]} progressBackgroundColor={appColors.surface} />}
        >
          {hasActiveFilters ? (
            <EmptyState
              icon="search-outline"
              title={t('projects.s_49')}
              description={t('projects.s_50')}
              action={{
                label: t('projects.s_51'),
                icon: 'refresh-outline',
                onPress: resetFilters,
              }}
            />
          ) : (
            <EmptyState icon="folder-open-outline" title={t('projects.s_37')} />
          )}
        </ScrollView>
      ) : viewMode === 'grid' ? (
        <FlatList
          key="grid"
          data={filtered}
          keyExtractor={(item) => String(item.id)}
          numColumns={2}
          columnWrapperStyle={styles.gridRow}
          style={styles.listBg}
          contentContainerStyle={[styles.gridContent, { paddingBottom: 32 + insets.bottom }]}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={appColors.primary} colors={[appColors.primary]} progressBackgroundColor={appColors.surface} />}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: false }
          )}
          scrollEventThrottle={16}
          renderItem={({ item, index }) => <GridCard project={item} index={index} />}
        />
      ) : (
        <FlatList
          key="list"
          data={filtered}
          keyExtractor={(item) => String(item.id)}
          style={styles.listBg}
          contentContainerStyle={[styles.listContent, { paddingBottom: 32 + insets.bottom }]}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={appColors.primary} colors={[appColors.primary]} progressBackgroundColor={appColors.surface} />}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: false }
          )}
          scrollEventThrottle={16}
          renderItem={({ item, index }) => <ListCard project={item} index={index} />}
        />
      )}

      {/* ── Leave modal ── */}
      <LeaveProjectReasonModal
        visible={Boolean(leaveProject)}
        projectTitle={leaveProject?.title}
        reason={leaveReason}
        loading={leaving}
        onChangeReason={setLeaveReason}
        onClose={() => {
          if (leaving) return;
          setLeaveProject(null);
          setLeaveReason('');
        }}
        onConfirm={confirmLeave}
      />
    </View>
  );
};

// ─────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: appColors.surfaceSoft,
  },

  // ── Sticky header ──
  stickyHeader: {
    backgroundColor: appColors.surfaceSoft,
    paddingHorizontal: 16,
    justifyContent: 'center',
    paddingVertical: 4,
    overflow: 'visible',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 40,
  },
  headerTitle: {
    fontWeight: '700',
    color: appColors.text,
  },
  viewToggle: {
    flexDirection: 'row',
    backgroundColor: appColors.surface,
    borderRadius: 10,
    padding: 3,
    gap: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  viewBtn: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },
  viewBtnActive: {
    backgroundColor: appColors.primarySurface,
  },

  // ── TF banner ──
  tfBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: appColors.bannerWarningBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: appColors.bannerWarningBorder,
  },
  tfBannerText: {
    fontSize: 12,
    fontWeight: '500',
    color: appColors.bannerWarningText,
    flex: 1,
  },

  // ── Search ──
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: appColors.surface,
    marginHorizontal: 16,
    marginBottom: 6,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: appColors.text,
  },

  // ── Filter chips ──
  filterScroll: {
    flexGrow: 0,
    flexShrink: 0,
    height: 44,
    marginBottom: 4,
  },
  filterRow: {
    paddingHorizontal: 16,
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    height: 44,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: appColors.surface,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 1,
  },
  chipActive: {
    backgroundColor: appColors.primary,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '500',
    color: appColors.textSecondary,
  },
  chipTextActive: {
    color: '#fff',
    fontWeight: '600',
  },

  // ── Result count ──
  resultCount: {
    fontSize: 12,
    color: appColors.textSecondary,
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 2,
  },

  // ── Empty ──
  emptyWrap: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  listBg: {
    backgroundColor: appColors.surfaceSoft,
  },

  // ── Grid ──
  gridContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 32,
  },
  gridRow: {
    justifyContent: 'space-between',
    alignItems: 'stretch',
    marginBottom: 12,
  },
  gridCard: {
    flex: 1,
    width: '100%',
    flexDirection: 'column',
    backgroundColor: appColors.surface,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.10,
    shadowRadius: 8,
    elevation: 3,
  },
  gridImageWrap: {
    position: 'relative',
  },
  gridImage: {
    width: '100%',
    height: 118,
    backgroundColor: appColors.surfaceMuted,
  },
  placeholder: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: appColors.primarySurface,
  },
  joinedOverlay: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: appColors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  typeDot: {
    position: 'absolute',
    top: 8,
    left: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gridBody: {
    flexGrow: 1,
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 6,
    gap: 4,
  },
  gridTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: appColors.text,
    lineHeight: 18,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  metaText: {
    fontSize: 11,
    color: appColors.textSecondary,
    flex: 1,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 2,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statIconWrap: {
    width: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statIconWrapList: {
    width: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statText: {
    fontSize: 11,
    lineHeight: 14,
    color: appColors.textSecondary,
    textAlignVertical: 'center',
  },
  statTextList: {
    fontSize: 11,
    lineHeight: 14,
    color: appColors.textSecondary,
    flex: 1,
    textAlignVertical: 'center',
  },
  gridActionBtn: {
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    marginHorizontal: 10,
    marginBottom: 10,
    marginTop: 6,
    paddingVertical: 10,
    borderRadius: 10,
  },
  gridActionBtnJoin: {
    backgroundColor: appColors.primary,
  },
  gridActionBtnJoined: {
    backgroundColor: appColors.dangerSurface,
    borderWidth: 1,
    borderColor: appColors.danger + '40',
  },
  gridActionText: {
    fontSize: 12,
    fontWeight: '700',
  },
  gridActionTextJoin: {
    color: '#fff',
  },
  gridActionTextJoined: {
    color: appColors.danger,
  },

  // ── List ──
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 32,
  },
  listCard: {
    backgroundColor: appColors.surface,
    borderRadius: 16,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  listThumbWrap: {
    position: 'relative',
  },
  listThumb: {
    width: 92,
    height: 92,
    backgroundColor: appColors.surfaceMuted,
  },
  listJoinedDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: appColors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  listBody: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 4,
  },
  typePill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    gap: 4,
  },
  typePillText: {
    fontSize: 10,
    color: '#fff',
    fontWeight: '700',
  },
  listTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: appColors.text,
    lineHeight: 19,
  },
  listActionBtn: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    borderRadius: 12,
  },
  listActionBtnJoin: {
    backgroundColor: appColors.primarySurface,
    borderWidth: 1,
    borderColor: appColors.primary + '30',
  },
  listActionBtnJoined: {
    backgroundColor: appColors.dangerSurface,
    borderWidth: 1,
    borderColor: appColors.danger + '30',
  },
});