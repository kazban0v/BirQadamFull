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
const getMonthName = (dateStr: string) => {
  try {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      // It's a day! return something like "15 Апр"
      const monthIdx = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      if (monthIdx >= 0 && monthIdx < 12) return `${day} ${MONTHS_RU[monthIdx]}`;
    } else if (parts.length === 2) {
      // It's a month!
      const monthIdx = parseInt(parts[1], 10) - 1;
      if (monthIdx >= 0 && monthIdx < 12) return MONTHS_RU[monthIdx];
    }
  } catch (e) { }
  return dateStr.substring(0, 5); // Fallback
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

        {/* ALL ACHIEVEMENTS LIST */}
        {activity && activity.months && activity.months.length > 0 && (
          <View style={styles.chartCard}>
            <View style={styles.chartHeaderRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={styles.chartTitle}>Активность</Text>
                <TouchableOpacity 
                  onPress={() => setShowInfoModal(true)} 
                  style={{ marginLeft: 6, marginBottom: 20 }}
                >
                  <Ionicons name="information-circle-outline" size={20} color={appColors.textMuted} />
                </TouchableOpacity>
              </View>
              <View style={styles.chartFiltersRow}>
                <TouchableOpacity
                  style={[styles.chartFilterBtn, (!!startDateStr || !!endDateStr) && styles.chartFilterBtnActive]}
                  onPress={() => {
                    setTempStart(startDateStr);
                    setTempEnd(endDateStr);
                    setShowDatePicker(true);
                  }}
                >
                  <Text style={[styles.chartFilterTxt, (!!startDateStr || !!endDateStr) && styles.chartFilterTxtActive]}>
                    {(startDateStr && endDateStr) ? `${getMonthName(startDateStr)} - ${getMonthName(endDateStr)}` : 'За последние 6 месяцев'}
                  </Text>
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

        {/* FILTERS */}
        <Text style={[styles.chartTitle, { marginHorizontal: 16, marginTop: 24, marginBottom: 12 }]}>Все награды</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={styles.filterContainer}>
          <TouchableOpacity
            style={[styles.filterButton, filter === 'all' && styles.filterButtonActive]}
            onPress={() => setFilter('all')}
          >
            <Text style={[styles.filterText, filter === 'all' && styles.filterTextActive]}>
              Все ({stats?.total_achievements || 0})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterButton, filter === 'unlocked' && styles.filterButtonActive]}
            onPress={() => setFilter('unlocked')}
          >
            <Text style={[styles.filterText, filter === 'unlocked' && styles.filterTextActive]}>
              Получено ({stats?.unlocked_achievements || 0})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterButton, filter === 'locked' && styles.filterButtonActive]}
            onPress={() => setFilter('locked')}
          >
            <Text style={[styles.filterText, filter === 'locked' && styles.filterTextActive]}>
              В процессе ({stats ? stats.total_achievements - stats.unlocked_achievements : 0})
            </Text>
          </TouchableOpacity>
        </ScrollView>

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

      {/* DATE PICKER MODAL */}
      <Modal visible={showDatePicker} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Выбор периода</Text>
            
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
                textDayHeaderFontSize: 13
              }}
            />
            
            <View style={{flexDirection: 'row', justifyContent: 'space-between', marginTop: 15, paddingHorizontal: 10}}>
              <View>
                <Text style={{fontSize: 12, color: appColors.textMuted}}>Начало:</Text>
                <Text style={{fontSize: 14, fontWeight: '600'}}>{tempStart || '---'}</Text>
              </View>
              <View style={{alignItems: 'flex-end'}}>
                <Text style={{fontSize: 12, color: appColors.textMuted}}>Конец:</Text>
                <Text style={{fontSize: 14, fontWeight: '600'}}>{tempEnd || '---'}</Text>
              </View>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalBtnCancel} onPress={() => setShowDatePicker(false)}>
                <Text style={styles.modalBtnCancelTxt}>Отмена</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.modalBtnClear} onPress={() => {
                setTempStart('');
                setTempEnd('');
                setStartDateStr('');
                setEndDateStr('');
                setShowDatePicker(false);
              }}>
                <Text style={styles.modalBtnClearTxt}>Сбросить</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.modalBtnApply} onPress={() => {
                if (tempStart && !tempEnd) {
                  setStartDateStr(tempStart);
                  setEndDateStr(tempStart);
                } else {
                  setStartDateStr(tempStart);
                  setEndDateStr(tempEnd);
                }
                setShowDatePicker(false);
              }}>
                <Text style={styles.modalBtnApplyTxt}>Применить</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* INFO MODAL */}
      <Modal visible={showInfoModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={{ alignItems: 'center', marginBottom: 16 }}>
              <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: 'rgba(16, 185, 129, 0.1)', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                <Ionicons name="information-circle" size={36} color={appColors.primary} />
              </View>
              <Text style={styles.modalTitle}>Активность</Text>
            </View>
            <Text style={{ fontSize: 15, color: appColors.textSecondary, lineHeight: 22, textAlign: 'center', marginBottom: 24 }}>
              Очки активности начисляются за выполненные задачи и прикрепленные к проектам фотоотчеты.{'\n\n'}
              Вы можете фильтровать этот график выбрав любой период из календаря. По умолчанию график показывает вашу активность за последние 6 месяцев.
            </Text>
            <TouchableOpacity style={[styles.modalBtnApply, { width: '100%', alignItems: 'center' }]} onPress={() => setShowInfoModal(false)}>
              <Text style={styles.modalBtnApplyTxt}>Понятно</Text>
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
  chartFiltersRow: {
    flexDirection: 'row',
    backgroundColor: appColors.surfaceSoft,
    borderRadius: 8,
    padding: 2,
  },
  chartFilterBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  chartFilterBtnActive: {
    backgroundColor: appColors.white,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  chartFilterTxt: {
    fontSize: 12,
    fontWeight: '600',
    color: appColors.textMuted,
  },
  chartFilterTxtActive: {
    color: appColors.primaryDark,
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
  filterScroll: {
    marginBottom: 16,
  },
  filterContainer: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterButton: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: appColors.surfaceSoft,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  filterButtonActive: {
    backgroundColor: appColors.primarySurface,
    borderColor: appColors.primary,
  },
  filterText: {
    fontSize: 14,
    color: appColors.textMuted,
    fontWeight: '600',
  },
  filterTextActive: {
    color: appColors.primaryDark,
  },
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
  emptySub: {
    fontSize: 14,
    color: appColors.textMuted,
    textAlign: 'center',
    marginTop: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    backgroundColor: appColors.surface,
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: appColors.text,
    marginBottom: 20,
    textAlign: 'center',
  },
  inputLabel: {
    fontSize: 13,
    color: appColors.textMuted,
    marginBottom: 6,
    fontWeight: '500',
  },
  inputWrapper: {
    backgroundColor: appColors.surfaceSoft,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: appColors.border,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 16,
  },
  dateInput: {
    fontSize: 16,
    color: appColors.text,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  modalBtnCancel: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  modalBtnCancelTxt: {
    color: appColors.textMuted,
    fontSize: 14,
    fontWeight: '600',
  },
  modalBtnClear: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  modalBtnClearTxt: {
    color: appColors.error,
    fontSize: 14,
    fontWeight: '600',
  },
  modalBtnApply: {
    backgroundColor: appColors.primary,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  modalBtnApplyTxt: {
    color: appColors.white,
    fontSize: 14,
    fontWeight: '700',
  },
});
