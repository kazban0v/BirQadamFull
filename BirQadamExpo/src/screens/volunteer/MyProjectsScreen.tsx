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
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useToast } from '../../components/Toast';
import { Ionicons } from '@expo/vector-icons';
import { volunteerAPI } from '../../services/api';
import { LeaveProjectReasonModal } from '../../components/projects/LeaveProjectReasonModal';
import type { Project } from '../../types';
import { normalizeImageUrl } from '../../utils/network';
import { getAxiosErrorMessage } from '../../utils/apiErrorMessage';
import { isProjectCurrentlyActive } from '../../utils/projectUtils';
import { appColors, getProjectTypeVisual } from '../../theme';
import { EmptyState } from '../../components/EmptyState';
import { useTranslation } from '../../locales/i18n';
import { ProjectCoverPlaceholder } from '../../components/dashboard/ProjectCoverPlaceholder';
import { SkeletonProjects } from '../../components/skeleton/screens/SkeletonProjects';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = (SCREEN_WIDTH - 48) / 2; // 2-column grid with padding

// ──────────────────────────────────────────
// View mode toggle: grid | list
// ──────────────────────────────────────────
type ViewMode = 'grid' | 'list';

interface VolunteerMyProjectsScreenProps {
  navigation: any;
}

// Русское склонение
const pluralizeRu = (n: number, one: string, few: string, many: string): string => {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
  return many;
};

function typeBadgeFor(
  volunteerType: string,
  t: (key: string) => string
): { label: string; icon: keyof typeof Ionicons.glyphMap; color: string } {
  const visual = getProjectTypeVisual(volunteerType);
  let label: string;
  switch (volunteerType) {
    case 'social':
      label = t('myprojects.s_14');
      break;
    case 'environmental':
      label = t('myprojects.s_15');
      break;
    case 'cultural':
      label = t('myprojects.s_16');
      break;
    default:
      label = volunteerType;
  }
  return { label, icon: visual.icon, color: visual.color };
}

export const VolunteerMyProjectsScreen: React.FC<VolunteerMyProjectsScreenProps> = ({
  navigation,
}) => {
  const { t } = useTranslation();
  const toast = useToast();
  const insets = useSafeAreaInsets();

  const [projects, setProjects] = useState<Project[]>([]);
  const [filtered, setFiltered] = useState<Project[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [leaveProject, setLeaveProject] = useState<Project | null>(null);
  const [leaveReason, setLeaveReason] = useState('');
  const [leaving, setLeaving] = useState(false);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'social' | 'environmental' | 'cultural'>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');

  // ── Animated header shrink ──
  const scrollY = useRef(new Animated.Value(0)).current;
  const headerHeight = scrollY.interpolate({
    inputRange: [0, 60],
    outputRange: [64, 52],
    extrapolate: 'clamp',
  });
  const headerTitleSize = scrollY.interpolate({
    inputRange: [0, 60],
    outputRange: [24, 18],
    extrapolate: 'clamp',
  });

  // ── Load ──
  const loadProjects = async (showSkeleton: boolean = false) => {
    if (showSkeleton) setLoading(true);
    try {
      const response = await volunteerAPI.getProjects();
      const projectsData = response.data.projects || [];
      const joinedProjects = projectsData.filter(
        (p: Project) => p.joined && isProjectCurrentlyActive(p)
      );
      setProjects(joinedProjects);
    } catch (error: unknown) {
      const errorMessage = getAxiosErrorMessage(error, t('myprojects.s_0'));
      toast.error(errorMessage);
    } finally {
      if (showSkeleton) setLoading(false);
    }
  };

  useEffect(() => { loadProjects(true); }, []);

  // ── Filter logic ──
  useEffect(() => {
    let result = [...projects];
    if (typeFilter !== 'all') {
      result = result.filter((p) => p.volunteer_type === typeFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          (p.city || '').toLowerCase().includes(q)
      );
    }
    setFiltered(result);
  }, [projects, typeFilter, search]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadProjects();
    setRefreshing(false);
  };

  const handleLeave = (project: Project) => {
    setLeaveProject(project);
    setLeaveReason('');
  };

  const confirmLeave = async () => {
    if (!leaveProject) return;
    const trimmedReason = leaveReason.trim();
    if (!trimmedReason) {
      toast.warning(t('myprojects.s_3'));
      return;
    }
    setLeaving(true);
    try {
      const response = await volunteerAPI.leaveProject(leaveProject.id, trimmedReason);
      const result = response.data;
      let message = result.message || t('myprojects.s_4');
      if (result.penalty_applied && result.trust_factor !== undefined) {
        message += ` Trust Factor: ${result.trust_factor} (-5 TF)`;
      }
      setLeaveProject(null);
      setLeaveReason('');
      toast.success(message);
      await loadProjects();
    } catch (error: unknown) {
      toast.error(getAxiosErrorMessage(error, t('myprojects.s_7')));
    } finally {
      setLeaving(false);
    }
  };

  // ──────────────────────────────────────────
  // GRID card (compact 2-col)
  // ──────────────────────────────────────────
  const GridCard = useCallback(({ project, index }: { project: Project; index: number }) => {
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(16)).current;

    useEffect(() => {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 280,
          delay: (index % 6) * 60,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 280,
          delay: (index % 6) * 60,
          useNativeDriver: true,
        }),
      ]).start();
    }, []);

    const { label, icon, color } = typeBadgeFor(project.volunteer_type, t);
    const imageUrl = normalizeImageUrl(project.cover_image_url);

    return (
      <Animated.View
        style={[
          styles.gridCardWrapper,
          { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
        ]}
      >
        <TouchableOpacity
          style={styles.gridCard}
          activeOpacity={0.88}
          onPress={() => navigation.navigate('VolunteerProjectDetail', { projectId: project.id })}
        >
          {/* Image */}
          <View style={styles.gridImageWrap}>
            {imageUrl ? (
              <Image source={{ uri: imageUrl }} style={styles.gridImage} resizeMode="cover" />
            ) : (
              <ProjectCoverPlaceholder style={styles.gridImage} size="sm" />
            )}
            {/* Type pill */}
            <View style={[styles.typePill, { backgroundColor: color }]}>
              <Ionicons name={icon} size={9} color="#fff" />
            </View>
          </View>

          {/* Body */}
          <View style={styles.gridBody}>
            <Text style={styles.gridTitle} numberOfLines={2}>
              {project.title}
            </Text>

            {project.city ? (
              <View style={styles.gridMeta}>
                <Ionicons name="location" size={11} color={appColors.textMuted} />
                <Text style={styles.gridMetaText} numberOfLines={1}>{project.city}</Text>
              </View>
            ) : null}

            <View style={styles.gridStats}>
              <View style={styles.gridStat}>
                <View style={styles.gridStatIconWrap}>
                  <Ionicons name="people-outline" size={12} color={appColors.primary} />
                </View>
                <Text
                  style={styles.gridStatText}
                  includeFontPadding={Platform.OS === 'android' ? false : undefined}
                >
                  {project.active_members || 0}
                </Text>
              </View>
              <View style={styles.gridStat}>
                <View style={styles.gridStatIconWrap}>
                  <Ionicons name="flag-outline" size={12} color={appColors.warning} />
                </View>
                <Text
                  style={styles.gridStatText}
                  includeFontPadding={Platform.OS === 'android' ? false : undefined}
                >
                  {project.tasks_count || 0}
                </Text>
              </View>
            </View>
          </View>

          {/* Footer */}
          <View style={styles.gridFooter}>
            <TouchableOpacity
              style={styles.leaveBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              onPress={(e) => { e.stopPropagation(); handleLeave(project); }}
            >
              <Ionicons name="exit-outline" size={13} color={appColors.danger} />
              <Text style={styles.leaveBtnText}>{t('myprojects.s_13')}</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  }, [navigation, t]);

  // ──────────────────────────────────────────
  // LIST card (full-width, more detail)
  // ──────────────────────────────────────────
  const ListCard = useCallback(({ project, index }: { project: Project; index: number }) => {
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(12)).current;

    useEffect(() => {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 260, delay: index * 50, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 260, delay: index * 50, useNativeDriver: true }),
      ]).start();
    }, []);

    const { label, icon, color } = typeBadgeFor(project.volunteer_type, t);
    const imageUrl = normalizeImageUrl(project.cover_image_url);

    return (
      <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
        <TouchableOpacity
          style={styles.listCard}
          activeOpacity={0.88}
          onPress={() => navigation.navigate('VolunteerProjectDetail', { projectId: project.id })}
        >
          {imageUrl ? (
            <Image source={{ uri: imageUrl }} style={styles.listImage} resizeMode="cover" />
          ) : (
            <ProjectCoverPlaceholder style={styles.listImage} size="sm" />
          )}

          <View style={styles.listBody}>
            <View style={[styles.typePillSmall, { backgroundColor: color }]}>
              <Ionicons name={icon} size={10} color="#fff" />
              <Text style={styles.typePillText}>{label}</Text>
            </View>

            <Text style={styles.listTitle} numberOfLines={2}>{project.title}</Text>

            {project.city ? (
              <View style={styles.gridMeta}>
                <Ionicons name="location" size={12} color={appColors.textMuted} />
                <Text style={styles.gridMetaText} numberOfLines={1}>{project.city}</Text>
              </View>
            ) : null}

            <View style={styles.listStatsRow}>
              <View style={styles.gridStat}>
                <View style={styles.listStatIconWrap}>
                  <Ionicons name="people-outline" size={12} color={appColors.primary} />
                </View>
                <Text
                  style={styles.gridStatTextList}
                  includeFontPadding={Platform.OS === 'android' ? false : undefined}
                >
                  {project.active_members || 0}{' '}
                  {pluralizeRu(project.active_members || 0, t('projects.s_42'), t('projects.s_43'), t('projects.s_44'))}
                </Text>
              </View>
              <View style={styles.gridStat}>
                <View style={styles.listStatIconWrap}>
                  <Ionicons name="flag-outline" size={12} color={appColors.warning} />
                </View>
                <Text
                  style={styles.gridStatTextList}
                  includeFontPadding={Platform.OS === 'android' ? false : undefined}
                >
                  {project.tasks_count || 0}{' '}
                  {pluralizeRu(project.tasks_count || 0, t('projects.s_45'), t('projects.s_46'), t('projects.s_47'))}
                </Text>
              </View>
            </View>
          </View>

          <TouchableOpacity
            style={styles.leaveIconBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            onPress={(e) => { e.stopPropagation(); handleLeave(project); }}
          >
            <Ionicons name="exit-outline" size={18} color={appColors.danger} />
          </TouchableOpacity>
        </TouchableOpacity>
      </Animated.View>
    );
  }, [navigation, t]);

  // ──────────────────────────────────────────
  // Type filter chips
  // ──────────────────────────────────────────
  const FilterChip = ({ id, label, icon }: { id: typeof typeFilter; label: string; icon: keyof typeof Ionicons.glyphMap }) => (
    <TouchableOpacity
      style={[styles.chip, typeFilter === id && styles.chipActive]}
      onPress={() => setTypeFilter(id)}
      activeOpacity={0.75}
    >
      <Ionicons
        name={icon}
        size={13}
        color={typeFilter === id ? '#fff' : appColors.textMuted}
      />
      <Text style={[styles.chipText, typeFilter === id && styles.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );

  // ──────────────────────────────────────────
  // Loading
  // ──────────────────────────────────────────
  if (loading) return <SkeletonProjects mode="my" viewMode={viewMode} />;

  const isEmpty = filtered.length === 0;
  const hasProjects = projects.length > 0;
  const hasActiveFilters = typeFilter !== 'all' || search.trim().length > 0;
  const resetFilters = () => {
    setTypeFilter('all');
    setSearch('');
  };

  return (
    <View style={styles.root}>
      {/* ── Animated sticky header ── */}
      <Animated.View style={[styles.stickyHeader, { height: headerHeight }]}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1, minWidth: 0, paddingRight: 12 }}>
            <Animated.Text style={[styles.headerTitle, { fontSize: headerTitleSize }]} numberOfLines={1}>
              {t('myprojects.s_17')}
            </Animated.Text>
          </View>
          {/* View mode toggle — только когда есть проекты */}
          {hasProjects && (
            <View style={styles.viewToggle}>
              <TouchableOpacity
                style={[styles.viewBtn, viewMode === 'grid' && styles.viewBtnActive]}
                onPress={() => setViewMode('grid')}
              >
                <Ionicons name="grid" size={16} color={viewMode === 'grid' ? appColors.primary : appColors.textMuted} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.viewBtn, viewMode === 'list' && styles.viewBtnActive]}
                onPress={() => setViewMode('list')}
              >
                <Ionicons name="list" size={18} color={viewMode === 'list' ? appColors.primary : appColors.textMuted} />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Animated.View>

      {/* ── Search bar (скрыт когда нет проектов) ── */}
      {hasProjects && (
        <View style={styles.searchWrap}>
          <Ionicons name="search" size={16} color={appColors.textMuted} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder={t('projects.s_48') + '...'}
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
      )}

      {/* ── Type filter chips (скрыт когда нет проектов) ── */}
      {hasProjects && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.chipScroll}
          contentContainerStyle={[styles.chipRow, { paddingRight: 16 }]}
        >
          <FilterChip id="all" label={t('myprojects.s_33') ?? 'Все'} icon="apps" />
          <FilterChip id="social" label={t('myprojects.s_14')} icon="people" />
          <FilterChip id="environmental" label={t('myprojects.s_15')} icon="leaf" />
          <FilterChip id="cultural" label={t('myprojects.s_16')} icon="color-palette" />
        </ScrollView>
      )}

      {/* ── Content ── */}
      {isEmpty ? (
        <ScrollView
          style={styles.listBg}
          contentContainerStyle={styles.emptyScroll}
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
            <EmptyState
              icon="folder-open-outline"
              title={t('myprojects.s_22')}
              description={t('myprojects.s_23')}
              action={{
                label: t('myprojects.s_25'),
                icon: 'compass-outline',
                onPress: () => navigation.navigate('VolunteerProjects'),
              }}
            />
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
    justifyContent: 'space-between',
    alignItems: 'center',
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

  // ── Search ──
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: appColors.surface,
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: appColors.text,
  },

  // ── Chips ──
  chipScroll: {
    flexGrow: 0,
    flexShrink: 0,
    height: 44,
    marginBottom: 4,
  },
  chipRow: {
    paddingHorizontal: 16,
    gap: 6,
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: appColors.surface,
    gap: 4,
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

  // ── Empty ──
  emptyScroll: {
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
  gridCardWrapper: {
    width: CARD_WIDTH,
    alignSelf: 'stretch',
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
  typePill: {
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
    marginBottom: 2,
    lineHeight: 18,
  },
  gridMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginBottom: 4,
  },
  gridMetaText: {
    fontSize: 11,
    color: appColors.textSecondary,
    flex: 1,
  },
  gridStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  gridStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  gridStatIconWrap: {
    width: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listStatIconWrap: {
    width: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gridStatText: {
    fontSize: 11,
    lineHeight: 14,
    color: appColors.textSecondary,
    textAlignVertical: 'center',
  },
  gridStatTextList: {
    fontSize: 11,
    lineHeight: 14,
    color: appColors.textSecondary,
    flex: 1,
    textAlignVertical: 'center',
  },
  gridFooter: {
    flexShrink: 0,
    paddingHorizontal: 10,
    paddingBottom: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderColor: appColors.border,
    marginTop: 6,
  },
  leaveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: appColors.dangerSurface,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: appColors.danger + '30',
  },
  leaveBtnText: {
    fontSize: 12,
    fontWeight: '700',
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
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  listImage: {
    width: 96,
    height: 96,
    backgroundColor: appColors.surfaceMuted,
  },
  listBody: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    justifyContent: 'center',
    gap: 4,
  },
  typePillSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    gap: 4,
    marginBottom: 2,
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
  listStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 2,
  },
  leaveIconBtn: {
    width: 48,
    height: 48,
    marginRight: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: appColors.dangerSurface,
    borderWidth: 1,
    borderColor: appColors.danger + '30',
  },
});