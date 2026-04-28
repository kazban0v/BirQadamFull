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
  Alert,
} from 'react-native';
import { Calendar, LocaleConfig } from 'react-native-calendars';

LocaleConfig.locales['ru'] = {
  monthNames: ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'],
  monthNamesShort: ['Янв.','Фев.','Мар','Апр','Май','Июн','Июл.','Авг','Сен.','Окт.','Ноя.','Дек.'],
  dayNames: ['Воскресенье','Понедельник','Вторник','Среда','Четверг','Пятница','Суббота'],
  dayNamesShort: ['Вс','Пн','Вт','Ср','Чт','Пт','Сб'],
  today: 'Сегодня'
};
LocaleConfig.defaultLocale = 'ru';

import { TextInputMask } from 'react-native-masked-text';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Header } from '../../components/Header';
import { volunteerAPI } from '../../services/api';
import type { VolunteerStats, VolunteerAchievement, VolunteerActivity } from '../../types';
import { appColors } from '../../theme';

interface VolunteerAchievementsScreenProps {
  navigation: any;
}

type FilterType = 'all' | 'unlocked' | 'locked';
type AchievementTier = 'bronze' | 'silver' | 'gold' | 'epic';
type DatePreset = 'last30' | 'last3m' | 'last6m' | 'last12m' | 'custom';

const { width } = Dimensions.get('window');

const TIER_CFG = {
  bronze: { label: 'Бронза', color: '#B87333', gradient: ['#c97c3a', '#a05c20'] as const, icon: 'medal' as const, bg: 'rgba(201,124,58,0.1)' },
  silver: { label: 'Серебро', color: '#A0B2C6', gradient: ['#8fa3b1', '#6b8696'] as const, icon: 'medal-outline' as const, bg: 'rgba(143,163,177,0.1)' },
  gold: { label: 'Золото', color: '#FCD34D', gradient: ['#e8b84b', '#c49020'] as const, icon: 'trophy' as const, bg: 'rgba(232,184,75,0.1)' },
  epic: { label: 'Эпик', color: '#10B981', gradient: ['#8bc34a', '#4a8c1c'] as const, icon: 'star' as const, bg: 'rgba(139,195,74,0.15)' },
};

function getTier(reqRating: number): AchievementTier {
  if (reqRating >= 500) return 'epic';
  if (reqRating >= 250) return 'gold';
  if (reqRating >= 100) return 'silver';
  return 'bronze';
}

const MONTHS_RU = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];
const PERIOD_PRESETS: Array<{ key: DatePreset; label: string; icon: string }> = [
  { key: 'last30', label: '30 дней', icon: 'time-outline' },
  { key: 'last3m', label: '3 месяца', icon: 'calendar-outline' },
  { key: 'last6m', label: '6 месяцев', icon: 'calendar-outline' },
  { key: 'last12m', label: '12 месяцев', icon: 'calendar-outline' },
  { key: 'custom', label: 'Свой период', icon: 'options-outline' },
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

const getMonthName = (dateStr: string) => {
  try {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const monthIdx = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      if (monthIdx >= 0 && monthIdx < 12) return `${day} ${MONTHS_RU[monthIdx]}`;
    } else if (parts.length === 2) {
      const monthIdx = parseInt(parts[1], 10) - 1;
      if (monthIdx >= 0 && monthIdx < 12) return MONTHS_RU[monthIdx];
    }
  } catch (e) { }
  return dateStr.substring(0, 5);
};

export const VolunteerAchievementsScreen: React.FC<VolunteerAchievementsScreenProps> = ({ navigation }) => {
  const [stats, setStats] = useState<VolunteerStats | null>(null);
  const [activity, setActivity] = useState<VolunteerActivity | null>(null);
  
  const [startDateStr, setStartDateStr] = useState<string>('');
  const [endDateStr, setEndDateStr] = useState<string>('');
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
    // Если фильтр не применен, показываем текст по умолчанию
    if (!startDateStr && !endDateStr) return 'Выбор периода';

    const preset = detectPreset(startDateStr, endDateStr);

    if (preset === 'last30') return 'За 30 дней';
    if (preset === 'last3m') return 'За 3 месяца';
    if (preset === 'last6m') return 'За 6 месяцев';
    if (preset === 'last12m') return 'За 12 месяцев';

    if (startDateStr && endDateStr) {
      return `${getMonthName(startDateStr)} — ${getMonthName(endDateStr)}`;
    }

    if (startDateStr) {
      return `С ${getMonthName(startDateStr)}`;
    }

    return 'Выбор периода';
  }, [startDateStr, endDateStr]);

  const isFilterActive = !!startDateStr || !!endDateStr;

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
    setTempStart('');
    setTempEnd('');
    setStartDateStr('');
    setEndDateStr('');
    setSelectedPreset('last6m');
    setShowCalendar(false);
    setShowDatePicker(false);
  };

  const AchievementCard = ({ achievement }: { achievement: VolunteerAchievement }) => {
    const tier = getTier(achievement.required_rating);
    const cfg = TIER_CFG[tier];
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
                <Ionicons name="calendar-outline" size={12} /> {new Date(achievement.unlocked_at).toLocaleDateString('ru-RU')}
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
              {achievement.unlocked ? 'Выполнено' : `${Math.floor(stats?.rating || 0)} / ${achievement.required_rating} очков`}
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
        <Header title="Достижения" showBack />
        <View style={styles.center}>
          <ActivityIndicator size="large" color={appColors.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header title="Достижения" showBack />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* HERO SECTION */}
        {stats && (
          <LinearGradient colors={['#1F2937', '#111827']} style={styles.heroBanner}>
            <Text style={styles.heroEyebrow}>ОБЩИЙ ПРОГРЕСС</Text>
            <View style={styles.heroRow}>
              <View style={styles.heroLeft}>
                <Text style={styles.heroLevel}>Уровень {stats.level}</Text>
                <Text style={styles.heroRating}>{Math.floor(stats.rating)} / {stats.next_level_rating} XP</Text>
                <View style={styles.heroProgressBg}>
                  <View style={[styles.heroProgressFill, { width: `${Math.min(100, Math.max(0, stats.progress * 100))}%` }]} />
                </View>
                <Text style={styles.heroHint}>Осталось {Math.max(0, stats.next_level_rating - stats.rating)} XP до след. уровня</Text>
              </View>
              <View style={styles.heroRight}>
                <View style={styles.ringContainer}>
                  <Text style={styles.ringValue}>{stats.unlocked_achievements}</Text>
                  <Text style={styles.ringLabel}>ИЗ {stats.total_achievements}</Text>
                </View>
              </View>
            </View>
          </LinearGradient>
        )}

        {/* ACTIVITY CHART */}
        {activity && activity.months && activity.months.length > 0 && (
          <View style={styles.chartCard}>
            {/* Chart header */}
            {/* Chart header */}
            <View style={styles.chartHeaderRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', flexShrink: 1, marginRight: 10 }}>
                <Text style={[styles.chartTitle, { marginBottom: 0 }]} numberOfLines={1}>
                  Активность
                </Text>
                <TouchableOpacity 
                  onPress={() => setShowInfoModal(true)} 
                  style={{ marginLeft: 6 }} 
                  // Убрали ломающий верстку marginBottom: 20
                >
                  <Ionicons name="information-circle-outline" size={20} color={appColors.textMuted} />
                </TouchableOpacity>
              </View>

              {/* ── Period filter button ── */}
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
                      <Text style={styles.barLabel} numberOfLines={1}>{getMonthName(month)}</Text>
                    </View>
                  );
                })}
              </View>
            </ScrollView>
            <View style={styles.chartLegend}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: appColors.primary }]} />
                <Text style={styles.legendText}>Получено очков</Text>
              </View>
            </View>
          </View>
        )}

        {/* STATS SUMMARY (Impact) */}
        {stats && activity && activity.totals && (
          <View style={styles.impactCard}>
            <Text style={styles.chartTitle}>Ваш вклад в общество</Text>
            <View style={styles.impactGrid}>
              <View style={styles.impactCell}>
                <Ionicons name="star" size={24} color="#FCD34D" style={styles.impactIcon} />
                <Text style={styles.impactVal}>{activity.totals['total_rating'] || Math.floor(stats.rating)}</Text>
                <Text style={styles.impactLbl}>набрано очков</Text>
              </View>
              <View style={styles.impactCell}>
                <Ionicons name="checkmark-circle" size={24} color={appColors.primary} style={styles.impactIcon} />
                <Text style={styles.impactVal}>{activity.totals['completed_tasks'] || 0}</Text>
                <Text style={styles.impactLbl}>задач решено</Text>
              </View>
            </View>
          </View>
        )}

        {/* ACHIEVEMENT FILTERS */}
        <Text style={[styles.chartTitle, { marginHorizontal: 16, marginTop: 24, marginBottom: 12 }]}>Все награды</Text>
        <View style={styles.achieveFilterRow}>
          {([
            { key: 'all', label: 'Все', count: stats?.total_achievements ?? 0 },
            { key: 'unlocked', label: 'Получено', count: stats?.unlocked_achievements ?? 0 },
            { key: 'locked', label: 'В процессе', count: stats ? stats.total_achievements - stats.unlocked_achievements : 0 },
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
            <View style={styles.emptyState}>
              <Ionicons name="trophy-outline" size={64} color={appColors.textSoft} />
              <Text style={styles.emptyText}>Ничего не найдено</Text>
            </View>
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
                  <Text style={styles.sheetTitle}>Период активности</Text>
                  <TouchableOpacity onPress={() => setShowDatePicker(false)} style={styles.sheetCloseBtn}>
                    <Ionicons name="close" size={20} color={appColors.textMuted} />
                  </TouchableOpacity>
                </View>

                <View style={styles.presetList}>
                  {PERIOD_PRESETS.map((preset) => {
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
                    <Text style={styles.sheetBtnResetTxt}>Сбросить</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.sheetBtnApply} onPress={handleApply}>
                    <Text style={styles.sheetBtnApplyTxt}>Применить</Text>
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
                  <Text style={styles.sheetTitle}>Свой период</Text>
                  <TouchableOpacity onPress={() => setShowDatePicker(false)} style={styles.sheetCloseBtn}>
                    <Ionicons name="close" size={20} color={appColors.textMuted} />
                  </TouchableOpacity>
                </View>

                {/* Date range indicator */}
                <View style={styles.dateRangeRow}>
                  <View style={[styles.dateRangeBox, tempStart ? styles.dateRangeBoxFilled : styles.dateRangeBoxEmpty]}>
                    <Text style={styles.dateRangeBoxLabel}>Начало</Text>
                    <Text style={[styles.dateRangeBoxVal, !tempStart && styles.dateRangeBoxPlaceholder]}>
                      {tempStart ? getMonthName(tempStart) : '—'}
                    </Text>
                  </View>
                  <View style={styles.dateRangeArrow}>
                    <Ionicons name="arrow-forward" size={16} color={appColors.textMuted} />
                  </View>
                  <View style={[styles.dateRangeBox, tempEnd ? styles.dateRangeBoxFilled : styles.dateRangeBoxEmpty]}>
                    <Text style={styles.dateRangeBoxLabel}>Конец</Text>
                    <Text style={[styles.dateRangeBoxVal, !tempEnd && styles.dateRangeBoxPlaceholder]}>
                      {tempEnd ? getMonthName(tempEnd) : '—'}
                    </Text>
                  </View>
                </View>

                {/* Step hint */}
                <Text style={styles.calendarStepHint}>
                  {!tempStart
                    ? '👆 Выберите начало периода'
                    : !tempEnd
                    ? '👆 Теперь выберите конец периода'
                    : '✅ Период выбран — нажмите «Применить»'}
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
                    <Text style={styles.sheetBtnResetTxt}>Очистить</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.sheetBtnApply, (!tempStart || !tempEnd) && styles.sheetBtnApplyDisabled]}
                    onPress={handleApply}
                    disabled={!tempStart || !tempEnd}
                  >
                    <Text style={styles.sheetBtnApplyTxt}>Применить</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

          </View>
        </View>
      </Modal>

      {/* INFO MODAL */}
      <Modal visible={showInfoModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.infoModalContent}>
            <View style={{ alignItems: 'center', marginBottom: 16 }}>
              <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: 'rgba(16, 185, 129, 0.1)', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                <Ionicons name="information-circle" size={36} color={appColors.primary} />
              </View>
              <Text style={styles.sheetTitle}>Активность</Text>
            </View>
            <Text style={{ fontSize: 15, color: appColors.textSecondary, lineHeight: 22, textAlign: 'center', marginBottom: 24 }}>
              Очки активности начисляются за выполненные задачи и прикрепленные к проектам фотоотчеты.{'\n\n'}
              Вы можете фильтровать этот график выбрав любой период из календаря. По умолчанию график показывает вашу активность за последние 6 месяцев.
            </Text>
            <TouchableOpacity style={styles.sheetBtnApply} onPress={() => setShowInfoModal(false)}>
              <Text style={styles.sheetBtnApplyTxt}>Понятно</Text>
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
  chartHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20, 
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
    maxWidth: '55%', 
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
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: appColors.textSoft,
    fontWeight: '600',
    marginTop: 16,
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

  // ── Info modal (centered, not sheet) ──
  infoModalContent: {
    margin: 20,
    marginTop: 'auto',
    marginBottom: 'auto',
    backgroundColor: appColors.surface,
    borderRadius: 24,
    padding: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
});