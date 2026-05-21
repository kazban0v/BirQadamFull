import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  Modal,
  Pressable,
  Platform,
} from 'react-native';
import { Calendar, LocaleConfig } from 'react-native-calendars';

const achievementsCalendarLocaleKey = (lang: string) =>
  lang === 'en' ? 'en' : lang === 'kk' ? 'kk' : 'ru';

const configureAchievementsLocale = (t: (key: string) => string, lang: string) => {
  const block = {
    monthNames: [t('achievements.s_0'), t('achievements.s_1'), t('achievements.s_2'), t('achievements.s_3'), t('achievements.s_4'), t('achievements.s_5'), t('achievements.s_6'), t('achievements.s_7'), t('achievements.s_8'), t('achievements.s_9'), t('achievements.s_10'), t('achievements.s_11')],
    monthNamesShort: [t('achievements.s_12'), t('achievements.s_13'), t('achievements.s_14'), t('achievements.s_15'), t('achievements.s_16'), t('achievements.s_17'), t('achievements.s_18'), t('achievements.s_19'), t('achievements.s_20'), t('achievements.s_21'), t('achievements.s_22'), t('achievements.s_23')],
    dayNames: [t('achievements.s_24'), t('achievements.s_25'), t('achievements.s_26'), t('achievements.s_27'), t('achievements.s_28'), t('achievements.s_29'), t('achievements.s_30')],
    dayNamesShort: [t('achievements.s_31'), t('achievements.s_32'), t('achievements.s_33'), t('achievements.s_34'), t('achievements.s_35'), t('achievements.s_36'), t('achievements.s_37')],
    today: t('achievements.s_38'),
  };
  const key = achievementsCalendarLocaleKey(lang);
  LocaleConfig.locales[key] = block;
  LocaleConfig.defaultLocale = key;
};

import { TextInputMask } from 'react-native-masked-text';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Header } from '../../components/Header';
import { volunteerAPI } from '../../services/api';
import type { VolunteerStats, VolunteerAchievement, VolunteerActivity, Task, PhotoReport } from '../../types';
import { appColors } from '../../theme';
import { EmptyState } from '../../components/EmptyState';
import { useTranslation } from "../../locales/i18n";

// ── Activity timeline helpers ──────────────────────────────────────────────
type ActivityEventType = 'task_completed' | 'photo_approved' | 'photo_rejected' | 'photo_pending';
interface ActivityEvent {
  id: string;
  type: ActivityEventType;
  date: string;
  title: string;
  subtitle?: string;
  meta?: string;
  taskId?: number;
}
const ACTIVITY_EVENT_CONFIG: Record<ActivityEventType, { icon: keyof typeof Ionicons.glyphMap; color: string; surface: string }> = {
  task_completed: { icon: 'checkmark-circle', color: appColors.primary, surface: appColors.primarySurface },
  photo_approved:  { icon: 'camera',          color: appColors.primary, surface: appColors.primarySurface },
  photo_rejected:  { icon: 'close-circle',    color: appColors.danger,  surface: appColors.dangerSurface  },
  photo_pending:   { icon: 'time-outline',    color: appColors.warning, surface: appColors.warningSurface },
};
const parseActivityDate = (s: string): Date => { const d = new Date(s); return isNaN(d.getTime()) ? new Date(0) : d; };
const buildActivityEvents = (tasks: Task[], photos: PhotoReport[]): ActivityEvent[] => {
  const events: ActivityEvent[] = [];
  for (const task of tasks) {
    if (task.status === 'completed' || task.status === 'under_review') {
      const date = task.photo_moderated_at || task.photo_uploaded_at || task.end_date || task.created_at;
      if (!date) continue;
      events.push({ id: `task-${task.id}`, type: 'task_completed', date, title: task.title, subtitle: task.project_title, meta: task.reward_points ? `+${task.reward_points} pts` : undefined, taskId: task.id });
    }
  }
  for (const report of photos) {
    const date = report.moderated_at || report.uploaded_at || report.created_at;
    if (!date) continue;
    const type: ActivityEventType = report.status === 'approved' ? 'photo_approved' : report.status === 'rejected' ? 'photo_rejected' : 'photo_pending';
    events.push({ id: `photo-${report.id}`, type, date, title: report.task_text || `Фотоотчёт #${report.id}`, subtitle: report.project_title, meta: report.rating ? `★ ${report.rating}` : undefined, taskId: report.task_id });
  }
  return events.sort((a, b) => parseActivityDate(b.date).getTime() - parseActivityDate(a.date).getTime());
};

/** Первая порция строк таймлайна; дальше — «Показать ещё». */
const ACTIVITY_TIMELINE_INITIAL = 8;
const ACTIVITY_TIMELINE_PAGE = 8;

interface VolunteerAchievementsScreenProps {
  navigation: any;
}

type FilterType = 'all' | 'unlocked' | 'locked';
type AchievementTier = 'bronze' | 'silver' | 'gold' | 'epic';
type DatePreset = 'last30' | 'last3m' | 'last6m' | 'last12m' | 'custom';

const { width } = Dimensions.get('window');

const getTierConfig = (t: (key: string) => string) => ({
  bronze: { label: t('achievements.s_39'), color: '#B87333', gradient: ['#c97c3a', '#a05c20'] as const, icon: 'medal' as const, bg: 'rgba(201,124,58,0.1)' },
  silver: { label: t('achievements.s_40'), color: '#A0B2C6', gradient: ['#8fa3b1', '#6b8696'] as const, icon: 'medal-outline' as const, bg: 'rgba(143,163,177,0.1)' },
  gold: { label: t('achievements.s_41'), color: '#FCD34D', gradient: ['#e8b84b', '#c49020'] as const, icon: 'trophy' as const, bg: 'rgba(232,184,75,0.1)' },
  epic: { label: t('achievements.s_42'), color: '#10B981', gradient: ['#8bc34a', '#4a8c1c'] as const, icon: 'star' as const, bg: 'rgba(139,195,74,0.15)' },
});

function getTier(reqRating: number): AchievementTier {
  if (reqRating >= 500) return 'epic';
  if (reqRating >= 250) return 'gold';
  if (reqRating >= 100) return 'silver';
  return 'bronze';
}

const getMonthsRu = (t: (key: string) => string) => [t('achievements.s_43'), t('achievements.s_44'), t('achievements.s_45'), t('achievements.s_46'), t('achievements.s_47'), t('achievements.s_48'), t('achievements.s_49'), t('achievements.s_50'), t('achievements.s_51'), t('achievements.s_52'), t('achievements.s_53'), t('achievements.s_54')];
const getPeriodPresets = (t: (key: string) => string): Array<{ key: DatePreset; label: string; icon: string }> => [
  { key: 'last30', label: t('achievements.s_55'), icon: 'time-outline' },
  { key: 'last3m', label: t('achievements.s_56'), icon: 'calendar-outline' },
  { key: 'last6m', label: t('achievements.s_57'), icon: 'calendar-outline' },
  { key: 'last12m', label: t('achievements.s_58'), icon: 'calendar-outline' },
  { key: 'custom', label: t('achievements.s_59'), icon: 'options-outline' },
];

const formatISODate = (date: Date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const subtractDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() - days);
  return next;
};

const subtractMonths = (date: Date, months: number) => {
  const next = new Date(date);
  next.setMonth(next.getMonth() - months);
  return next;
};

const buildPresetRange = (preset: Exclude<DatePreset, 'custom'>) => {
  const end = new Date();
  const start =
    preset === 'last30'
      ? subtractDays(end, 29)
      : preset === 'last3m'
      ? subtractMonths(end, 3)
      : preset === 'last6m'
      ? subtractMonths(end, 6)
      : subtractMonths(end, 12);

  return {
    start: formatISODate(start),
    end: formatISODate(end),
  };
};

const detectPreset = (start: string, end: string): DatePreset => {
  if (!start && !end) {
    return 'last6m';
  }

  for (const preset of ['last30', 'last3m', 'last6m', 'last12m'] as const) {
    const range = buildPresetRange(preset);
    if (range.start === start && range.end === end) {
      return preset;
    }
  }

  return 'custom';
};

const getMonthName = (dateStr: string, monthsRu: string[]) => {
  try {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const monthIdx = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      if (monthIdx >= 0 && monthIdx < 12) return `${day} ${monthsRu[monthIdx]}`;
    } else if (parts.length === 2) {
      const monthIdx = parseInt(parts[1], 10) - 1;
      if (monthIdx >= 0 && monthIdx < 12) return monthsRu[monthIdx];
    }
  } catch (e) { }
  return dateStr.substring(0, 5);
};

export const VolunteerAchievementsScreen: React.FC<VolunteerAchievementsScreenProps> = ({ navigation }) => {
  const { t, language } = useTranslation();
  const dateLocaleTag = language === 'en' ? 'en-US' : language === 'kk' ? 'kk-KZ' : 'ru-RU';
  const tierConfig = useMemo(() => getTierConfig(t), [t]);
  const monthsRu = useMemo(() => getMonthsRu(t), [t]);
  const periodPresets = useMemo(() => getPeriodPresets(t), [t]);
  const defaultActivityRange = useMemo(() => buildPresetRange('last6m'), []);
  const [stats, setStats] = useState<VolunteerStats | null>(null);
  const [activity, setActivity] = useState<VolunteerActivity | null>(null);
  
  const [startDateStr, setStartDateStr] = useState<string>(defaultActivityRange.start);
  const [endDateStr, setEndDateStr] = useState<string>(defaultActivityRange.end);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [tempStart, setTempStart] = useState('');
  const [tempEnd, setTempEnd] = useState('');
  const [selectedPreset, setSelectedPreset] = useState<DatePreset>('last6m');
  // Controls whether the calendar is visible inside the modal (only for custom)
  const [showCalendar, setShowCalendar] = useState(false);

  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>('all');
  const [activityEvents, setActivityEvents] = useState<ActivityEvent[]>([]);
  const [activityVisibleCount, setActivityVisibleCount] = useState(ACTIVITY_TIMELINE_INITIAL);

  useEffect(() => {
    setActivityVisibleCount(ACTIVITY_TIMELINE_INITIAL);
  }, [activityEvents]);

  const displayedActivityEvents = useMemo(
    () => activityEvents.slice(0, activityVisibleCount),
    [activityEvents, activityVisibleCount],
  );
  const hasMoreActivity = activityVisibleCount < activityEvents.length;

  useEffect(() => {
    configureAchievementsLocale(t, language);
  }, [t, language]);

  const loadData = async () => {
    try {
      const [statsRes, activityRes] = await Promise.all([
        volunteerAPI.getStats(),
        volunteerAPI.getActivity({ 
          start_date: startDateStr || undefined, 
          end_date: endDateStr || undefined 
        }),
      ]);
      setStats(statsRes.data);
      setActivity(activityRes.data);

      // Загружаем таймлайн с паузой чтобы не бить rate limit
      await new Promise<void>((resolve) => setTimeout(resolve, 400));
      const [tasksRes, photosRes] = await Promise.all([
        volunteerAPI.getTasks(),
        volunteerAPI.getPhotoReports(),
      ]);
      const rawTasks = tasksRes.data;
      const tasks: Task[] = Array.isArray(rawTasks) ? rawTasks : (rawTasks?.tasks ?? rawTasks?.results ?? []);
      const rawPhotos = photosRes.data;
      const photos: PhotoReport[] = Array.isArray(rawPhotos) ? rawPhotos : (rawPhotos?.photo_reports ?? rawPhotos?.photos ?? rawPhotos?.results ?? []);
      setActivityEvents(buildActivityEvents(tasks, photos));
    } catch (error) {
      console.error('Error loading stats/achievements:', error);
    }
  };

  useEffect(() => {
    setLoading(true);
    loadData().finally(() => setLoading(false));
  }, [startDateStr, endDateStr]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const filteredAchievements = useMemo(() => {
    if (!stats) return [];
    const arr = [...stats.achievements];
    if (filter === 'unlocked') return arr.filter((a) => a.unlocked);
    if (filter === 'locked') return arr.filter((a) => !a.unlocked);
    return arr;
  }, [stats, filter]);

  const sortedAchievements = useMemo(() => {
    return [...filteredAchievements].sort((a, b) => {
      if (a.unlocked !== b.unlocked) return a.unlocked ? -1 : 1;
      return (a.required_rating || 0) - (b.required_rating || 0);
    });
  }, [filteredAchievements]);

  const getActivityMax = () => {
    if (!activity) return 100;
    const totals = activity.months.map((_, i) => 
      Object.values(activity.series).reduce((acc, arr) => acc + (arr[i] || 0), 0)
    );
    const maxVal = Math.max(...totals);
    return maxVal > 0 ? maxVal : 100;
  };

  const getMarkedDates = () => {
    const dates: any = {};
    if (tempStart) {
      dates[tempStart] = { startingDay: true, color: appColors.primary, textColor: 'white' };
    }
    if (tempEnd) {
      dates[tempEnd] = { endingDay: true, color: appColors.primary, textColor: 'white' };
    }
    if (tempStart && tempEnd) {
      let curr = new Date(tempStart);
      const end = new Date(tempEnd);
      curr.setDate(curr.getDate() + 1);
      while (curr < end) {
        const dStr = curr.toISOString().split('T')[0];
        dates[dStr] = { color: 'rgba(16, 185, 129, 0.15)', textColor: appColors.text };
        curr.setDate(curr.getDate() + 1);
      }
    }
    return dates;
  };

  const onDayPress = (day: any) => {
    setSelectedPreset('custom');
    const dateStr = day.dateString;
    if (!tempStart || (tempStart && tempEnd)) {
      setTempStart(dateStr);
      setTempEnd('');
    } else if (tempStart && !tempEnd) {
      if (dateStr < tempStart) {
        setTempEnd(tempStart);
        setTempStart(dateStr);
      } else {
        setTempEnd(dateStr);
      }
    }
  };

  const periodSummary = useMemo(() => {
    const preset = detectPreset(startDateStr, endDateStr);

    if (preset === 'last30') return t('achievements.s_55');
    if (preset === 'last3m') return t('achievements.s_56');
    if (preset === 'last6m') return t('achievements.s_57');
    if (preset === 'last12m') return t('achievements.s_58');

    if (startDateStr && endDateStr) {
      return `${getMonthName(startDateStr, monthsRu)} — ${getMonthName(endDateStr, monthsRu)}`;
    }

    if (startDateStr) {
      return `С ${getMonthName(startDateStr, monthsRu)}`;
    }

    return t('achievements.s_65');
  }, [startDateStr, endDateStr, t, monthsRu]);

  /** Подсветка периода только если не стандартные последние 6 месяцев (совпадает с запросом к API) */
  const activityPreset = useMemo(() => detectPreset(startDateStr, endDateStr), [startDateStr, endDateStr]);
  const isFilterActive = activityPreset !== 'last6m';

  const handlePresetSelect = (preset: DatePreset) => {
    setSelectedPreset(preset);
    if (preset === 'custom') {
      setShowCalendar(true);
      return;
    }
    setShowCalendar(false);
    const range = buildPresetRange(preset);
    setTempStart(range.start);
    setTempEnd(range.end);
  };

  const handleOpenDatePicker = () => {
    const currentPreset = detectPreset(startDateStr, endDateStr);
    setTempStart(startDateStr);
    setTempEnd(endDateStr);
    setSelectedPreset(currentPreset);
    setShowCalendar(currentPreset === 'custom');
    setShowDatePicker(true);
  };

  const handleApply = () => {
    if (tempStart && !tempEnd) {
      setStartDateStr(tempStart);
      setEndDateStr(tempStart);
    } else {
      setStartDateStr(tempStart);
      setEndDateStr(tempEnd);
    }
    setShowDatePicker(false);
  };

  const handleReset = () => {
    const range = buildPresetRange('last6m');
    setTempStart(range.start);
    setTempEnd(range.end);
    setStartDateStr(range.start);
    setEndDateStr(range.end);
    setSelectedPreset('last6m');
    setShowCalendar(false);
    setShowDatePicker(false);
  };

  const AchievementCard = ({ achievement }: { achievement: VolunteerAchievement }) => {
    const tier = getTier(achievement.required_rating);
    const cfg = tierConfig[tier];
    const progressPct = achievement.unlocked
      ? 100
      : Math.min(100, Math.round(((stats?.rating || 0) / achievement.required_rating) * 100));

    return (
      <View style={[styles.achievementCard, !achievement.unlocked && styles.achievementLocked]}>
        <View style={styles.cardRibbon}>
          <Text style={[styles.ribbonText, { color: cfg.color }]}>{cfg.label}</Text>
        </View>

        <View style={styles.achievementHeader}>
          {achievement.unlocked ? (
            <LinearGradient colors={cfg.gradient} style={styles.achievementIconFilled}>
              <Ionicons name={cfg.icon} size={24} color="#FFF" />
            </LinearGradient>
          ) : (
            <View style={styles.achievementIconOutline}>
              <Ionicons name="lock-closed" size={24} color={appColors.textMuted} />
            </View>
          )}

          <View style={styles.achievementContent}>
            <Text style={styles.achievementTitle} numberOfLines={2}>{achievement.name}</Text>
            {achievement.unlocked && achievement.unlocked_at && (
              <Text style={styles.achievementDate}>
                <Ionicons name="calendar-outline" size={12} />{' '}
                {new Date(achievement.unlocked_at).toLocaleDateString(dateLocaleTag)}
              </Text>
            )}
          </View>
        </View>

        <Text style={styles.achievementDescription} numberOfLines={3}>
          {achievement.description}
        </Text>

        <View style={styles.progressContainer}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressText}>
              {achievement.unlocked
                ? t('achievements.s_66')
                : t('achievements.s_99', {
                    current: Math.floor(stats?.rating || 0),
                    required: achievement.required_rating,
                  })}
            </Text>
            <Text style={[styles.progressXp, { color: cfg.color }]}>+{achievement.xp} XP</Text>
          </View>
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: `${progressPct}%`, backgroundColor: achievement.unlocked ? cfg.color : appColors.textMuted }]} />
          </View>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Header title={t('achievements.s_67')} showBack />
        <View style={styles.center}>
          <ActivityIndicator size="large" color={appColors.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header title={t('achievements.s_100')} showBack />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* HERO SECTION */}
        {stats && (
          <LinearGradient colors={['#1F2937', '#111827']} style={styles.heroBanner}>
            <Text style={styles.heroEyebrow}>{t('achievements.s_69')}</Text>
            <View style={styles.heroRow}>
              <View style={styles.heroLeft}>
                <Text style={styles.heroLevel}>
                  {t('achievements.s_70', { level: stats.level })}
                </Text>
                <Text style={styles.heroRating}>{Math.floor(stats.rating)} / {stats.next_level_rating} XP</Text>
                <View style={styles.heroProgressBg}>
                  <View style={[styles.heroProgressFill, { width: `${Math.min(100, Math.max(0, stats.progress * 100))}%` }]} />
                </View>
                <Text style={styles.heroHint}>
                  {t('achievements.s_71', {
                    value: Math.max(0, stats.next_level_rating - stats.rating),
                  })}
                </Text>
              </View>
              <View style={styles.heroRight}>
                <View style={styles.ringContainer}>
                  <Text style={styles.ringValue}>{stats.unlocked_achievements}</Text>
                  <Text style={styles.ringLabel}>
                    {t('achievements.s_73', { total: stats.total_achievements })}
                  </Text>
                </View>
              </View>
            </View>
          </LinearGradient>
        )}

        {/* ACTIVITY CHART */}
        {activity && activity.months && activity.months.length > 0 && (
          <View style={styles.chartCard}>
            <View style={styles.chartHeaderColumn}>
              <View style={styles.chartHeaderTitleRow}>
                <Text style={[styles.chartTitle, { marginBottom: 0, flex: 1, minWidth: 0 }]} numberOfLines={2}>
                  {t('achievements.s_74')}
                </Text>
                <TouchableOpacity
                  onPress={() => setShowInfoModal(true)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  style={styles.chartInfoButton}
                  accessibilityRole="button"
                >
                  <Ionicons name="information-circle-outline" size={22} color={appColors.textMuted} />
                </TouchableOpacity>
              </View>
              <View style={styles.chartHeaderPeriodRow}>
                <TouchableOpacity
                  style={[styles.periodBtn, isFilterActive && styles.periodBtnActive]}
                  onPress={handleOpenDatePicker}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name="calendar-outline"
                    size={14}
                    color={isFilterActive ? appColors.primary : appColors.textMuted}
                    style={{ marginRight: 5 }}
                  />
                  <Text style={[styles.periodBtnTxt, isFilterActive && styles.periodBtnTxtActive]} numberOfLines={1}>
                    {periodSummary}
                  </Text>
                  <Ionicons
                    name="chevron-down"
                    size={13}
                    color={isFilterActive ? appColors.primary : appColors.textMuted}
                    style={{ marginLeft: 4 }}
                  />
                </TouchableOpacity>
              </View>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }} contentContainerStyle={{ paddingRight: 20 }}>
              <View style={[styles.chartRow, { width: Math.max(width - 48, activity.months.length * 45), marginTop: 0 }]}>
                {activity.months.map((month, i) => {
                  const totalPts = Object.values(activity.series).reduce((acc, arr) => acc + (arr[i] || 0), 0);
                  const heightPct = Math.min(85, (totalPts / getActivityMax()) * 85);
                  const isZero = totalPts === 0;

                  return (
                    <View key={`${month}-${i}`} style={styles.barCol}>
                      <View style={styles.barWrap}>
                        {!isZero && <Text style={styles.barValue} numberOfLines={1}>{totalPts}</Text>}
                        <View style={[styles.barFill, { height: `${heightPct}%`, backgroundColor: isZero ? 'transparent' : appColors.primary, minHeight: isZero ? 0 : 4, borderRadius: 4 }]} />
                      </View>
                      <Text style={styles.barLabel} numberOfLines={1}>{getMonthName(month, monthsRu)}</Text>
                    </View>
                  );
                })}
              </View>
            </ScrollView>
            <View style={styles.chartLegend}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: appColors.primary }]} />
                <Text style={styles.legendText}>{t('achievements.s_75')}</Text>
              </View>
            </View>
          </View>
        )}

        {/* STATS SUMMARY (Impact) */}
        {stats && activity && activity.totals && (
          <View style={styles.impactCard}>
            <Text style={styles.chartTitle}>{t('achievements.s_76')}</Text>
            <View style={styles.impactGrid}>
              <View style={styles.impactCell}>
                <Ionicons name="star" size={24} color="#FCD34D" style={styles.impactIcon} />
                <Text style={styles.impactVal}>{activity.totals['total_rating'] || Math.floor(stats.rating)}</Text>
                <Text style={styles.impactLbl}>{t('achievements.s_77')}</Text>
              </View>
              <View style={styles.impactCell}>
                <Ionicons name="checkmark-circle" size={24} color={appColors.primary} style={styles.impactIcon} />
                <Text style={styles.impactVal}>{activity.totals['completed_tasks'] || 0}</Text>
                <Text style={styles.impactLbl}>{t('achievements.s_78')}</Text>
              </View>
            </View>
          </View>
        )}

        {/* ACTIVITY TIMELINE */}
        <View style={styles.activitySection}>
          <View style={styles.activityHeader}>
            <View style={styles.activityHeaderLeft}>
              <View style={styles.activityHeaderIcon}>
                <Ionicons name="pulse" size={20} color={appColors.primaryDark} />
              </View>
              <View style={{ flex: 1, flexShrink: 1 }}>
                <Text style={styles.activitySectionTitle}>{t('activity.s_0')}</Text>
                {activityEvents.length > 0 ? (
                  <View style={styles.activityHeaderMeta}>
                    <View style={styles.activityCountPill}>
                      <Text style={styles.activityCountPillText}>{activityEvents.length}</Text>
                    </View>
                    <Text style={styles.activitySectionSub}>{t('activity.s_1')}</Text>
                  </View>
                ) : null}
              </View>
            </View>
          </View>

          {activityEvents.length === 0 ? (
            <View style={styles.activityEmpty}>
              <View style={styles.activityEmptyIcon}>
                <Ionicons name="time-outline" size={28} color={appColors.textMuted} />
              </View>
              <Text style={styles.activityEmptyTitle}>{t('activity.s_9')}</Text>
              <Text style={styles.activityEmptyDesc}>{t('activity.s_10')}</Text>
            </View>
          ) : (
            <>
              <View style={styles.activityList}>
                {displayedActivityEvents.map((event, index) => {
                  const cfg = ACTIVITY_EVENT_CONFIG[event.type];
                  const isLast = index === displayedActivityEvents.length - 1;
                  const label =
                    event.type === 'task_completed'
                      ? t('activity.s_2')
                      : event.type === 'photo_approved'
                        ? t('activity.s_3')
                        : event.type === 'photo_rejected'
                          ? t('activity.s_4')
                          : t('activity.s_5');
                  const dateStr = parseActivityDate(event.date).toLocaleDateString(dateLocaleTag, {
                    day: 'numeric',
                    month: 'short',
                  });
                  return (
                    <View key={event.id} style={styles.activityRow}>
                      {/* Left: line + dot */}
                      <View style={styles.activityLeft}>
                        <View style={[styles.activityDotOuter, { borderColor: cfg.color + '30' }]}>
                          <View style={[styles.activityDotInner, { backgroundColor: cfg.color }]}>
                            <Ionicons name={cfg.icon} size={11} color="#fff" />
                          </View>
                        </View>
                        {!isLast && <View style={styles.activityLine} />}
                      </View>

                      {/* Card */}
                      <View style={[styles.activityCard, { backgroundColor: cfg.surface }]}>
                        <View style={styles.activityCardTop}>
                          <View style={[styles.activityTypePill, { backgroundColor: cfg.color + '18' }]}>
                            <Ionicons name={cfg.icon} size={11} color={cfg.color} style={{ marginRight: 4 }} />
                            <Text style={[styles.activityTypePillText, { color: cfg.color }]}>{label}</Text>
                          </View>
                          <Text style={styles.activityDateText}>{dateStr}</Text>
                        </View>
                        <Text style={styles.activityCardTitle} numberOfLines={2}>
                          {event.title}
                        </Text>
                        {event.subtitle || event.meta ? (
                          <View style={styles.activityCardBottom}>
                            {event.subtitle ? (
                              <View style={styles.activitySubRow}>
                                <Ionicons name="folder-outline" size={11} color={appColors.textMuted} />
                                <Text style={styles.activitySubText} numberOfLines={1}>
                                  {event.subtitle}
                                </Text>
                              </View>
                            ) : null}
                            {event.meta ? (
                              <Text style={[styles.activityMetaText, { color: cfg.color }]}>{event.meta}</Text>
                            ) : null}
                          </View>
                        ) : null}
                      </View>
                    </View>
                  );
                })}
              </View>
              {hasMoreActivity ? (
                <View style={styles.activityShowMoreWrap}>
                  <LinearGradient
                    pointerEvents="none"
                    colors={['rgba(148,163,184,0)', 'rgba(203,213,225,0.35)']}
                    style={styles.activityShowMoreFadeTop}
                  />
                  <TouchableOpacity
                    activeOpacity={0.9}
                    onPress={() =>
                      setActivityVisibleCount((c) => Math.min(c + ACTIVITY_TIMELINE_PAGE, activityEvents.length))
                    }
                    style={styles.activityShowMoreTouchable}
                    accessibilityRole="button"
                    accessibilityLabel={t('activity.s_11')}
                  >
                    <LinearGradient
                      colors={[appColors.primarySurfaceStrong, appColors.primarySurface]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.activityShowMoreGradient}
                    >
                      <View style={styles.activityShowMoreRow}>
                        <View style={styles.activityShowMoreIconRing}>
                          <Ionicons name="chevron-down" size={17} color={appColors.primaryDark} />
                        </View>
                        <Text style={styles.activityShowMoreBtnText}>{t('activity.s_11')}</Text>
                      </View>
                    </LinearGradient>
                  </TouchableOpacity>
                  <View style={styles.activityShowMoreHintPill}>
                    <Text style={styles.activityShowMoreHint}>
                      {t('activity.s_12', {
                        shown: String(displayedActivityEvents.length),
                        total: String(activityEvents.length),
                      })}
                    </Text>
                  </View>
                </View>
              ) : null}
            </>
          )}
        </View>

        {/* ACHIEVEMENT FILTERS */}
        <Text style={[styles.chartTitle, { marginHorizontal: 16, marginTop: 24, marginBottom: 12 }]}>{t('achievements.s_79')}</Text>
        <View style={styles.achieveFilterRow}>
          {([
            { key: 'all', label: t('achievements.s_80'), count: stats?.total_achievements ?? 0 },
            { key: 'unlocked', label: t('achievements.s_81'), count: stats?.unlocked_achievements ?? 0 },
            { key: 'locked', label: t('achievements.s_82'), count: stats ? stats.total_achievements - stats.unlocked_achievements : 0 },
          ] as { key: FilterType; label: string; count: number }[]).map((item) => (
            <TouchableOpacity
              key={item.key}
              style={[styles.achieveFilterTab, filter === item.key && styles.achieveFilterTabActive]}
              onPress={() => setFilter(item.key)}
              activeOpacity={0.8}
            >
              <Text style={[styles.achieveFilterLabel, filter === item.key && styles.achieveFilterLabelActive]}>
                {item.label}
              </Text>
              <View style={[styles.achieveFilterBadge, filter === item.key && styles.achieveFilterBadgeActive]}>
                <Text style={[styles.achieveFilterBadgeTxt, filter === item.key && styles.achieveFilterBadgeTxtActive]}>
                  {item.count}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        <View style={{ paddingHorizontal: 16 }}>
          {sortedAchievements.length === 0 ? (
            <EmptyState icon="trophy-outline" title={t('achievements.s_83')} />
          ) : (
            sortedAchievements.map((achievement) => (
              <AchievementCard key={achievement.id} achievement={achievement} />
            ))
          )}
        </View>
      </ScrollView>

      {/* ══════════════════════════════════════════════
          DATE PICKER MODAL — two-step flow
      ══════════════════════════════════════════════ */}
      <Modal visible={showDatePicker} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, showCalendar && styles.modalSheetTall]}>

            {/* Handle bar */}
            <View style={styles.sheetHandle} />

            {/* ── STEP 1: Preset list ── */}
            {!showCalendar && (
              <>
                <View style={styles.sheetTitleRow}>
                  <Text style={styles.sheetTitle}>{t('achievements.s_84')}</Text>
                  <TouchableOpacity onPress={() => setShowDatePicker(false)} style={styles.sheetCloseBtn}>
                    <Ionicons name="close" size={20} color={appColors.textMuted} />
                  </TouchableOpacity>
                </View>

                <View style={styles.presetList}>
                  {periodPresets.map((preset) => {
                    const active = selectedPreset === preset.key;
                    return (
                      <TouchableOpacity
                        key={preset.key}
                        style={[styles.presetRow, active && styles.presetRowActive]}
                        onPress={() => handlePresetSelect(preset.key)}
                        activeOpacity={0.75}
                      >
                        <View style={[styles.presetIconWrap, active && styles.presetIconWrapActive]}>
                          <Ionicons
                            name={preset.icon as any}
                            size={18}
                            color={active ? appColors.primary : appColors.textMuted}
                          />
                        </View>
                        <Text style={[styles.presetLabel, active && styles.presetLabelActive]}>
                          {preset.label}
                        </Text>
                        {preset.key === 'custom' ? (
                          <Ionicons name="chevron-forward" size={18} color={appColors.textMuted} style={{ marginLeft: 'auto' }} />
                        ) : active ? (
                          <Ionicons name="checkmark-circle" size={20} color={appColors.primary} style={{ marginLeft: 'auto' }} />
                        ) : null}
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <View style={styles.sheetActions}>
                  <TouchableOpacity style={styles.sheetBtnReset} onPress={handleReset}>
                    <Text style={styles.sheetBtnResetTxt}>{t('achievements.s_85')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.sheetBtnApply} onPress={handleApply}>
                    <Text style={styles.sheetBtnApplyTxt}>{t('achievements.s_86')}</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

            {/* ── STEP 2: Custom calendar ── */}
            {showCalendar && (
              <>
                {/* Back + title */}
                <View style={styles.sheetTitleRow}>
                  <TouchableOpacity
                    onPress={() => {
                      setShowCalendar(false);
                      setSelectedPreset('last6m');
                      const range = buildPresetRange('last6m');
                      setTempStart(range.start);
                      setTempEnd(range.end);
                    }}
                    style={styles.sheetBackBtn}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="chevron-back" size={20} color={appColors.text} />
                  </TouchableOpacity>
                  <Text style={styles.sheetTitle}>{t('achievements.s_87')}</Text>
                  <TouchableOpacity onPress={() => setShowDatePicker(false)} style={styles.sheetCloseBtn}>
                    <Ionicons name="close" size={20} color={appColors.textMuted} />
                  </TouchableOpacity>
                </View>

                {/* Date range indicator */}
                <View style={styles.dateRangeRow}>
                  <View style={[styles.dateRangeBox, tempStart ? styles.dateRangeBoxFilled : styles.dateRangeBoxEmpty]}>
                    <Text style={styles.dateRangeBoxLabel}>{t('achievements.s_88')}</Text>
                    <Text style={[styles.dateRangeBoxVal, !tempStart && styles.dateRangeBoxPlaceholder]}>
                      {tempStart ? getMonthName(tempStart, monthsRu) : '—'}
                    </Text>
                  </View>
                  <View style={styles.dateRangeArrow}>
                    <Ionicons name="arrow-forward" size={16} color={appColors.textMuted} />
                  </View>
                  <View style={[styles.dateRangeBox, tempEnd ? styles.dateRangeBoxFilled : styles.dateRangeBoxEmpty]}>
                    <Text style={styles.dateRangeBoxLabel}>{t('achievements.s_89')}</Text>
                    <Text style={[styles.dateRangeBoxVal, !tempEnd && styles.dateRangeBoxPlaceholder]}>
                      {tempEnd ? getMonthName(tempEnd, monthsRu) : '—'}
                    </Text>
                  </View>
                </View>

                {/* Step hint */}
                <Text style={styles.calendarStepHint}>
                  {!tempStart
                    ? t('achievements.s_90')
                    : !tempEnd
                    ? t('achievements.s_91')
                    : t('achievements.s_92')}
                </Text>

                {/* Calendar */}
                <Calendar
                  markingType={'period'}
                  markedDates={getMarkedDates()}
                  onDayPress={onDayPress}
                  theme={{
                    calendarBackground: appColors.surface,
                    textSectionTitleColor: appColors.textMuted,
                    selectedDayBackgroundColor: appColors.primary,
                    selectedDayTextColor: '#ffffff',
                    todayTextColor: appColors.primary,
                    dayTextColor: appColors.text,
                    textDisabledColor: appColors.border,
                    arrowColor: appColors.primary,
                    monthTextColor: appColors.text,
                    textMonthFontWeight: 'bold',
                    textDayHeaderFontWeight: '600',
                    textDayFontSize: 14,
                    textMonthFontSize: 16,
                    textDayHeaderFontSize: 13,
                  }}
                />

                {/* Actions */}
                <View style={styles.sheetActions}>
                  <TouchableOpacity
                    style={styles.sheetBtnReset}
                    onPress={() => { setTempStart(''); setTempEnd(''); }}
                  >
                    <Text style={styles.sheetBtnResetTxt}>{t('achievements.s_93')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.sheetBtnApply, (!tempStart || !tempEnd) && styles.sheetBtnApplyDisabled]}
                    onPress={handleApply}
                    disabled={!tempStart || !tempEnd}
                  >
                    <Text style={styles.sheetBtnApplyTxt}>{t('achievements.s_94')}</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

          </View>
        </View>
      </Modal>

      <Modal visible={showInfoModal} transparent animationType="fade" statusBarTranslucent>
        <View style={styles.infoModalOverlay}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setShowInfoModal(false)} />
          <View style={styles.infoModalContent}>
            <View style={{ alignItems: 'center', marginBottom: 16 }}>
              <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: 'rgba(16, 185, 129, 0.1)', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                <Ionicons name="information-circle" size={36} color={appColors.primary} />
              </View>
              <Text style={styles.sheetTitle}>{t('achievements.s_95')}</Text>
            </View>
            <Text style={{ fontSize: 15, color: appColors.textSecondary, lineHeight: 22, textAlign: 'center', marginBottom: 24 }}>
              {t('achievements.s_96')}{'\n\n'}
              {t('achievements.s_97')}</Text>
            <TouchableOpacity style={styles.sheetBtnApply} onPress={() => setShowInfoModal(false)}>
              <Text style={styles.sheetBtnApplyTxt}>{t('achievements.s_98')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: appColors.background,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },

  // ── Hero ──
  heroBanner: {
    margin: 16,
    borderRadius: 24,
    padding: 24,
    shadowColor: '#111827',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 5,
  },
  heroEyebrow: {
    color: '#9CA3AF',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 16,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroLeft: {
    flex: 1,
    minWidth: 0,
    paddingRight: 16,
  },
  heroLevel: {
    color: '#F9FAFB',
    fontSize: 32,
    fontWeight: '900',
    marginBottom: 4,
  },
  heroRating: {
    color: '#D1D5DB',
    fontSize: 14,
    marginBottom: 14,
  },
  heroProgressBg: {
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  heroProgressFill: {
    height: '100%',
    backgroundColor: appColors.primary,
    borderRadius: 4,
  },
  heroHint: {
    color: '#9CA3AF',
    fontSize: 12,
    flexShrink: 1,
  },
  heroRight: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    borderTopColor: appColors.primary,
    borderRightColor: appColors.primary,
  },
  ringValue: {
    color: '#F9FAFB',
    fontSize: 22,
    fontWeight: '900',
  },
  ringLabel: {
    color: '#9CA3AF',
    fontSize: 10,
    fontWeight: '800',
    marginTop: 2,
  },

  // ── Chart card ──
  chartCard: {
    marginHorizontal: 16,
    backgroundColor: appColors.surface,
    borderRadius: 24,
    padding: 24,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: appColors.border,
  },
  chartTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: appColors.text,
    marginBottom: 20,
  },
  chartHeaderColumn: {
    width: '100%',
    marginBottom: 20,
  },
  chartHeaderTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  chartInfoButton: {
    marginTop: 2,
    padding: 4,
    zIndex: 2,
  },
  chartHeaderPeriodRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 10,
    width: '100%',
  },

  // ── Period button (replaces the old chartFilterBtn) ──
  periodBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: appColors.surfaceSoft,
    borderWidth: 1,
    borderColor: appColors.border,
    flexShrink: 1,
    maxWidth: '100%',
  },
  periodBtnActive: {
    backgroundColor: appColors.primarySurface,
    borderColor: appColors.primary,
  },
  periodBtnTxt: {
    fontSize: 12,
    fontWeight: '600',
    color: appColors.textMuted,
    flexShrink: 1,
  },
  periodBtnTxtActive: {
    color: appColors.primary,
  },

  chartRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 180,
    marginTop: 10,
    paddingBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: appColors.border,
  },
  barCol: {
    flex: 1,
    alignItems: 'center',
    height: '100%',
    justifyContent: 'flex-end',
  },
  barWrap: {
    width: '100%',
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  barFill: {
    width: '100%',
    maxWidth: 36,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  barValue: {
    fontSize: 12,
    fontWeight: 'bold',
    color: appColors.textMuted,
    marginBottom: 4,
  },
  barLabel: {
    fontSize: 12,
    color: appColors.textMuted,
    fontWeight: '600',
  },
  chartLegend: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  legendText: {
    fontSize: 12,
    color: appColors.textMuted,
    fontWeight: '500',
  },

  // ── Impact card ──
  impactCard: {
    marginHorizontal: 16,
    backgroundColor: appColors.surface,
    borderRadius: 24,
    padding: 24,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: appColors.border,
  },
  impactGrid: {
    flexDirection: 'row',
    gap: 16,
  },
  impactCell: {
    flex: 1,
    padding: 16,
    backgroundColor: appColors.surfaceSoft,
    borderRadius: 16,
    alignItems: 'flex-start',
  },
  impactIcon: {
    marginBottom: 8,
  },
  impactVal: {
    fontSize: 24,
    fontWeight: '900',
    color: appColors.text,
    marginBottom: 4,
  },
  impactLbl: {
    fontSize: 12,
    color: appColors.textMuted,
    fontWeight: '600',
  },

  // ── Achievement filter tabs (replaces old scroll filter) ──
  achieveFilterRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: appColors.surfaceSoft,
    borderRadius: 16,
    padding: 4,
    borderWidth: 1,
    borderColor: appColors.border,
  },
  achieveFilterTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    gap: 6,
  },
  achieveFilterTabActive: {
    backgroundColor: appColors.surface,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  achieveFilterLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: appColors.textMuted,
  },
  achieveFilterLabelActive: {
    color: appColors.text,
    fontWeight: '700',
  },
  achieveFilterBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: appColors.border,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  achieveFilterBadgeActive: {
    backgroundColor: appColors.primarySurface,
  },
  achieveFilterBadgeTxt: {
    fontSize: 11,
    fontWeight: '700',
    color: appColors.textMuted,
  },
  achieveFilterBadgeTxtActive: {
    color: appColors.primary,
  },

  // ── Achievement cards ──
  achievementCard: {
    backgroundColor: appColors.surface,
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: appColors.border,
    position: 'relative',
    overflow: 'hidden',
  },
  achievementLocked: {
    opacity: 0.85,
    backgroundColor: appColors.surfaceSoft,
  },
  cardRibbon: {
    position: 'absolute',
    top: 20,
    right: 20,
  },
  ribbonText: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  achievementHeader: {
    flexDirection: 'row',
    marginBottom: 16,
    paddingRight: 60,
  },
  achievementIconFilled: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  achievementIconOutline: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
    backgroundColor: '#E5E7EB',
  },
  achievementContent: {
    flex: 1,
    justifyContent: 'center',
  },
  achievementTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: appColors.text,
    marginBottom: 4,
  },
  achievementDate: {
    fontSize: 12,
    color: appColors.primaryDark,
    fontWeight: '600',
  },
  achievementDescription: {
    fontSize: 14,
    color: appColors.textSecondary,
    lineHeight: 22,
    marginBottom: 16,
  },
  progressContainer: {
    marginTop: 'auto',
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  progressText: {
    fontSize: 13,
    color: appColors.textMuted,
    fontWeight: '600',
  },
  progressXp: {
    fontSize: 13,
    fontWeight: '800',
  },
  progressBarBg: {
    height: 6,
    backgroundColor: appColors.border,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },

  // ── Modal base ──
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },

  // ── Date picker bottom sheet ──
  modalSheet: {
    backgroundColor: appColors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingBottom: 36,
    paddingTop: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 10,
  },
  // Taller variant when calendar is shown
  modalSheetTall: {
    maxHeight: '92%',
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: appColors.border,
    alignSelf: 'center',
    marginBottom: 20,
  },
  sheetTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: appColors.text,
  },
  sheetCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: appColors.surfaceSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetBackBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: appColors.surfaceSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Preset rows ──
  presetList: {
    gap: 8,
    marginBottom: 20,
  },
  presetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: appColors.surfaceSoft,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  presetRowActive: {
    backgroundColor: appColors.primarySurface,
    borderColor: appColors.primary,
  },
  presetIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: appColors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  presetIconWrapActive: {
    backgroundColor: 'rgba(16,185,129,0.15)',
  },
  presetLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: appColors.textSecondary,
  },
  presetLabelActive: {
    color: appColors.text,
    fontWeight: '700',
  },

  // ── Date range indicator (step 2) ──
  dateRangeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  dateRangeBox: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1.5,
  },
  dateRangeBoxFilled: {
    backgroundColor: appColors.primarySurface,
    borderColor: appColors.primary,
  },
  dateRangeBoxEmpty: {
    backgroundColor: appColors.surfaceSoft,
    borderColor: appColors.border,
    borderStyle: 'dashed',
  },
  dateRangeBoxLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: appColors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  dateRangeBoxVal: {
    fontSize: 15,
    fontWeight: '800',
    color: appColors.text,
  },
  dateRangeBoxPlaceholder: {
    color: appColors.textMuted,
    fontWeight: '600',
  },
  dateRangeArrow: {
    width: 28,
    alignItems: 'center',
  },

  // ── Calendar step hint ──
  calendarStepHint: {
    fontSize: 13,
    fontWeight: '600',
    color: appColors.textMuted,
    textAlign: 'center',
    marginBottom: 12,
  },

  // ── Sheet action buttons ──
  sheetActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  sheetBtnReset: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    backgroundColor: appColors.surfaceSoft,
    borderWidth: 1,
    borderColor: appColors.border,
  },
  sheetBtnResetTxt: {
    fontSize: 15,
    fontWeight: '700',
    color: appColors.danger,
  },
  sheetBtnApply: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    backgroundColor: appColors.primary,
  },
  sheetBtnApplyDisabled: {
    opacity: 0.45,
  },
  sheetBtnApplyTxt: {
    fontSize: 15,
    fontWeight: '700',
    color: appColors.white,
  },

  infoModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },

  // ── Info modal (centered, not sheet) ──
  infoModalContent: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: appColors.surface,
    borderRadius: 24,
    padding: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 12,
    zIndex: 2,
  },

  // ── Activity timeline section ──
  activitySection: {
    marginHorizontal: 16,
    backgroundColor: appColors.surface,
    borderRadius: 24,
    padding: 22,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: appColors.border,
    ...(Platform.OS === 'ios'
      ? {
          shadowColor: '#0F172A',
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.06,
          shadowRadius: 16,
        }
      : { elevation: 2 }),
  },
  activityHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  activityHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    flexShrink: 1,
  },
  activityHeaderIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: appColors.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.22)',
    ...(Platform.OS === 'ios'
      ? {
          shadowColor: '#10B981',
          shadowOffset: { width: 0, height: 3 },
          shadowOpacity: 0.22,
          shadowRadius: 7,
        }
      : { elevation: 3 }),
  },
  activitySectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: appColors.text,
    lineHeight: 23,
    letterSpacing: -0.4,
  },
  activityHeaderMeta: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginTop: 10,
  },
  activityCountPill: {
    flexShrink: 0,
    minWidth: 34,
    height: 30,
    paddingHorizontal: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 15,
    backgroundColor: appColors.primarySurfaceStrong,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.35)',
  },
  activityCountPillText: {
    fontSize: 14,
    fontWeight: '800',
    color: appColors.primaryDark,
    letterSpacing: -0.4,
  },
  activitySectionSub: {
    flex: 1,
    flexShrink: 1,
    fontSize: 12,
    color: appColors.textMuted,
    fontWeight: '600',
    lineHeight: 16,
  },
  activityEmpty: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 10,
  },
  activityEmptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: appColors.surfaceSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  activityEmptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: appColors.textSecondary,
  },
  activityEmptyDesc: {
    fontSize: 13,
    color: appColors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
  activityList: {
    gap: 0,
    marginTop: 2,
  },
  activityRow: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  activityLeft: {
    alignItems: 'center',
    width: 38,
    marginRight: 10,
  },
  activityDotOuter: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: appColors.surface,
    zIndex: 1,
    ...(Platform.OS === 'ios'
      ? {
          shadowColor: '#64748B',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.13,
          shadowRadius: 4,
        }
      : { elevation: 1 }),
  },
  activityDotInner: {
    width: 23,
    height: 23,
    borderRadius: 11.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityLine: {
    flex: 1,
    width: 3,
    marginTop: 3,
    marginBottom: -2,
    borderRadius: 2,
    backgroundColor: 'rgba(203, 213, 225, 0.7)',
  },
  activityCard: {
    flex: 1,
    borderRadius: 18,
    padding: 14,
    marginBottom: 0,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: appColors.borderSoft,
    ...(Platform.OS === 'ios'
      ? {
          shadowColor: '#64748B',
          shadowOffset: { width: 0, height: 5 },
          shadowOpacity: 0.08,
          shadowRadius: 12,
        }
      : { elevation: 2 }),
  },
  activityCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    gap: 8,
  },
  activityTypePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    flexShrink: 1,
    maxWidth: '78%',
  },
  activityTypePillText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.15,
    flexShrink: 1,
  },
  activityDateText: {
    fontSize: 11,
    color: appColors.textMuted,
    fontWeight: '700',
    flexShrink: 0,
    opacity: 0.92,
  },
  activityCardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: appColors.text,
    lineHeight: 21,
    marginBottom: 6,
    letterSpacing: -0.25,
  },
  activityCardBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  activitySubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  activitySubText: {
    fontSize: 12,
    color: appColors.textMuted,
    flex: 1,
  },
  activityMetaText: {
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 8,
  },
  activityShowMoreWrap: {
    marginTop: 10,
    marginHorizontal: -2,
    alignItems: 'stretch',
    gap: 14,
    paddingBottom: 2,
  },
  activityShowMoreFadeTop: {
    height: 22,
    width: '100%',
    opacity: 1,
    marginBottom: -4,
    borderRadius: 6,
    overflow: 'hidden',
  },
  activityShowMoreTouchable: {
    borderRadius: 18,
    overflow: 'hidden',
    ...(Platform.OS === 'ios'
      ? {
          shadowColor: '#059669',
          shadowOffset: { width: 0, height: 5 },
          shadowOpacity: 0.2,
          shadowRadius: 12,
        }
      : { elevation: 3 }),
  },
  activityShowMoreGradient: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.32)',
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  activityShowMoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  activityShowMoreIconRing: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: appColors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(16, 185, 129, 0.4)',
    opacity: 0.96,
  },
  activityShowMoreBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: appColors.primaryDark,
    letterSpacing: -0.15,
  },
  activityShowMoreHintPill: {
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: appColors.surfaceSoft,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: appColors.borderSoft,
    maxWidth: '100%',
  },
  activityShowMoreHint: {
    fontSize: 12,
    color: appColors.textMuted,
    fontWeight: '600',
    textAlign: 'center',
    letterSpacing: -0.1,
    lineHeight: 16,
  },
});
