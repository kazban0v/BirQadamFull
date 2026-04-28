import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';

import { volunteerAPI } from '../../services/api';
import type { CalendarEvent } from '../../types';
import { appColors } from '../../theme';

type CalendarEventGroup = {
  key: string;
  projectId: number | null;
  title: string;
  subtitle: string | null;
  location: string;
  projectEvents: CalendarEvent[];
  taskEvents: CalendarEvent[];
};

const WEEKDAY_LABELS = ['ВС', 'ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ'];

const padNumber = (value: number) => value.toString().padStart(2, '0');

const formatMonthKey = (date: Date) => `${date.getFullYear()}-${padNumber(date.getMonth() + 1)}`;

const parseDateKey = (value: string) => {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
};

const buildDateKey = (date: Date) =>
  `${date.getFullYear()}-${padNumber(date.getMonth() + 1)}-${padNumber(date.getDate())}`;

const startOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1);

const addMonths = (date: Date, amount: number) => new Date(date.getFullYear(), date.getMonth() + amount, 1);

const buildCalendarDays = (monthDate: Date) => {
  const monthStart = startOfMonth(monthDate);
  const calendarStart = new Date(monthStart);
  calendarStart.setDate(monthStart.getDate() - monthStart.getDay());

  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(calendarStart);
    day.setDate(calendarStart.getDate() + index);
    return day;
  });
};

const formatMonthTitle = (date: Date) =>
  date.toLocaleDateString('ru-RU', {
    month: 'long',
    year: 'numeric',
  });

const formatSelectedDateTitle = (value: string) =>
  parseDateKey(value).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
  });

const isTodayKey = (value: string) => buildDateKey(new Date()) === value;

const getEventTypeConfig = (type: string) => {
  switch (type) {
    case 'project_start':
      return {
        label: 'Старт проекта',
        color: '#22C55E',
        softColor: appColors.primarySurfaceStrong,
        icon: 'leaf-outline' as const,
      };
    case 'project_end':
      return {
        label: 'Завершение проекта',
        color: '#2563EB',
        softColor: '#DBEAFE',
        icon: 'flag-outline' as const,
      };
    default:
      return {
        label: 'Задача',
        color: '#BE123C',
        softColor: '#FFE4E6',
        icon: 'document-text-outline' as const,
      };
  }
};

const getStatusConfig = (status?: string | null) => {
  switch (status) {
    case 'completed':
      return {
        label: 'Завершено',
        color: '#15803D',
        backgroundColor: appColors.primarySurfaceStrong,
      };
    case 'approved':
      return {
        label: 'Одобрено',
        color: '#047857',
        backgroundColor: appColors.primarySurfaceStrong,
      };
    case 'under_review':
      return {
        label: 'На проверке',
        color: '#047857',
        backgroundColor: appColors.primarySurfaceStrong,
      };
    case 'revision':
      return {
        label: 'На доработке',
        color: '#2563EB',
        backgroundColor: '#DBEAFE',
      };
    case 'rejected':
      return {
        label: 'Отклонено',
        color: '#BE123C',
        backgroundColor: '#FFE4E6',
      };
    case 'in_progress':
      return {
        label: 'В работе',
        color: appColors.primary,
        backgroundColor: appColors.surfaceMuted,
      };
    case 'open':
      return {
        label: 'Открыта',
        color: '#0F766E',
        backgroundColor: appColors.primarySurface,
      };
    case 'archived':
      return {
        label: 'В архиве',
        color: appColors.textMuted,
        backgroundColor: appColors.surfaceMuted,
      };
    default:
      return status
        ? {
            label: status,
            color: appColors.textMuted,
            backgroundColor: appColors.surfaceMuted,
          }
        : null;
  }
};

const formatEventTime = (event: CalendarEvent) => {
  if (event.is_all_day) {
    return 'Весь день';
  }

  const start = event.start_time?.slice(0, 5);
  const end = event.end_time?.slice(0, 5);

  if (start && end) {
    return `${start} - ${end}`;
  }

  if (start) {
    return start;
  }

  return 'Время уточняется';
};

const getEventLocation = (event: CalendarEvent) =>
  event.location || event.project_address || event.project_city || 'Локация уточняется';

const getEventGroupKey = (event: CalendarEvent) => {
  if (event.project_id != null) {
    return `project-${event.project_id}`;
  }

  if (event.source_type === 'project') {
    return `project-source-${event.source_id}`;
  }

  return `${event.source_type}-${event.source_id}`;
};

const getEventNodeTitle = (event: CalendarEvent) => {
  if (event.source_type === 'project') {
    return getEventTypeConfig(event.type).label;
  }

  return event.title;
};

const compareCalendarEvents = (left: CalendarEvent, right: CalendarEvent) => {
  const priority = (event: CalendarEvent) => {
    if (event.source_type === 'project' && event.type === 'project_start') {
      return 0;
    }

    if (event.source_type === 'task') {
      return 1;
    }

    if (event.source_type === 'project' && event.type === 'project_end') {
      return 2;
    }

    return 3;
  };

  return (
    priority(left) - priority(right) ||
    (left.start_time || '00:00').localeCompare(right.start_time || '00:00') ||
    left.title.localeCompare(right.title)
  );
};

const selectInitialDate = (events: CalendarEvent[], monthDate: Date, previous?: string) => {
  const monthKey = formatMonthKey(monthDate);
  if (previous?.startsWith(monthKey)) {
    return previous;
  }

  const todayKey = buildDateKey(new Date());
  if (todayKey.startsWith(monthKey)) {
    return todayKey;
  }

  if (events.length > 0) {
    return events[0].date;
  }

  return buildDateKey(startOfMonth(monthDate));
};

export const VolunteerCalendarScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { width } = useWindowDimensions();
  const isCompact = width < 390;

  const [displayMonth, setDisplayMonth] = useState(() => startOfMonth(new Date()));
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [selectedDateKey, setSelectedDateKey] = useState(() => buildDateKey(new Date()));
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const monthKey = useMemo(() => formatMonthKey(displayMonth), [displayMonth]);

  const loadCalendarEvents = useCallback(
    async (showRefresh = false) => {
      if (showRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      try {
        const response = await volunteerAPI.getCalendarEvents(monthKey);
        const nextEvents = Array.isArray(response.data?.events)
          ? response.data.events.filter(
              (event) =>
                !['meeting', 'reminder'].includes(event.type) &&
                (event.source_type !== 'task' || event.status === 'open')
            )
          : [];

        setEvents(nextEvents);
        setSelectedDateKey((previous) => selectInitialDate(nextEvents, displayMonth, previous));
      } catch (error) {
        if (__DEV__) {
          console.error('Ошибка загрузки календаря:', error);
        }
        setEvents([]);
        setSelectedDateKey(buildDateKey(startOfMonth(displayMonth)));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [displayMonth, monthKey]
  );

  useFocusEffect(
    useCallback(() => {
      loadCalendarEvents();
    }, [loadCalendarEvents])
  );

  const eventsByDate = useMemo(() => {
    return events.reduce<Record<string, CalendarEvent[]>>((accumulator, event) => {
      if (!accumulator[event.date]) {
        accumulator[event.date] = [];
      }
      accumulator[event.date].push(event);
      return accumulator;
    }, {});
  }, [events]);

  const monthDays = useMemo(() => buildCalendarDays(displayMonth), [displayMonth]);
  const selectedEvents = eventsByDate[selectedDateKey] ?? [];
  const groupedSelectedEvents = useMemo(() => {
    const groups = selectedEvents.reduce<Map<string, CalendarEventGroup>>((accumulator, event) => {
      const key = getEventGroupKey(event);
      const existing = accumulator.get(key);

      if (existing) {
        if (event.source_type === 'task') {
          existing.taskEvents.push(event);
        } else {
          existing.projectEvents.push(event);
        }
        return accumulator;
      }

      accumulator.set(key, {
        key,
        projectId: event.project_id ?? (event.source_type === 'project' ? event.source_id : null),
        title: event.project_title || event.title,
        subtitle: event.project_city || event.project_type || event.subtitle || null,
        location: getEventLocation(event),
        projectEvents: event.source_type === 'task' ? [] : [event],
        taskEvents: event.source_type === 'task' ? [event] : [],
      });

      return accumulator;
    }, new Map());

    return Array.from(groups.values())
      .map((group) => ({
        ...group,
        projectEvents: [...group.projectEvents].sort(compareCalendarEvents),
        taskEvents: [...group.taskEvents].sort(compareCalendarEvents),
      }))
      .sort((left, right) => left.title.localeCompare(right.title));
  }, [selectedEvents]);

  const legendItems = useMemo(
    () => ['project_start', 'project_end', 'task_deadline'].map(getEventTypeConfig),
    []
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingScreen}>
        <ActivityIndicator size="large" color={appColors.primary} />
        <Text style={styles.loadingText}>Загружаем календарь задач...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadCalendarEvents(true)} tintColor="#10B981" />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.headerCaption}>Календарь волонтёра</Text>
            <Text style={styles.headerTitle}>Календарь</Text>
          </View>
          <TouchableOpacity style={styles.headerAction} onPress={() => loadCalendarEvents(true)} activeOpacity={0.85}>
            <Ionicons name="refresh-outline" size={20} color="#0A0A0A" />
          </TouchableOpacity>
        </View>

        <View style={styles.calendarCard}>
          <View style={styles.monthRow}>
            <TouchableOpacity style={styles.monthButton} onPress={() => setDisplayMonth((current) => addMonths(current, -1))}>
              <Ionicons name="chevron-back" size={20} color="#0A0A0A" />
            </TouchableOpacity>

            <Text style={[styles.monthTitle, isCompact && styles.monthTitleCompact]}>
              {formatMonthTitle(displayMonth)}
            </Text>

            <TouchableOpacity style={styles.monthButton} onPress={() => setDisplayMonth((current) => addMonths(current, 1))}>
              <Ionicons name="chevron-forward" size={20} color="#0A0A0A" />
            </TouchableOpacity>
          </View>

          <View style={styles.weekdaysRow}>
            {WEEKDAY_LABELS.map((label) => (
              <Text key={label} style={styles.weekdayLabel}>
                {label}
              </Text>
            ))}
          </View>

          <View style={styles.daysGrid}>
            {monthDays.map((day) => {
              const key = buildDateKey(day);
              const dayEvents = eventsByDate[key] ?? [];
              const dayDots = Array.from(new Set(dayEvents.map((event) => getEventTypeConfig(event.type).color))).slice(0, 4);
              const isCurrentMonth = day.getMonth() === displayMonth.getMonth();
              const isSelected = key === selectedDateKey;

              return (
                <TouchableOpacity
                  key={key}
                  style={[
                    styles.dayCell,
                    isSelected && styles.dayCellSelected,
                    !isCurrentMonth && styles.dayCellMuted,
                  ]}
                  onPress={() => setSelectedDateKey(key)}
                  activeOpacity={0.85}
                >
                  <Text
                    style={[
                      styles.dayNumber,
                      !isCurrentMonth && styles.dayNumberMuted,
                      isSelected && styles.dayNumberSelected,
                      isTodayKey(key) && !isSelected && styles.dayNumberToday,
                    ]}
                  >
                    {day.getDate()}
                  </Text>

                  <View style={styles.dayDotsRow}>
                    {dayDots.map((color) => (
                      <View key={`${key}-${color}`} style={[styles.dayDot, { backgroundColor: color }]} />
                    ))}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.legendRow}>
            {legendItems.map((item) => (
              <View key={item.label} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: item.color }]} />
                <Text style={styles.legendText}>{item.label}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>События на {formatSelectedDateTitle(selectedDateKey)}</Text>
          <Text style={styles.sectionCount}>{selectedEvents.length}</Text>
        </View>

        {selectedEvents.length ? (
          groupedSelectedEvents.map((group) => {
            const projectEventCount = group.projectEvents.length;
            const taskEventCount = group.taskEvents.length;
            const groupEvents = [...group.projectEvents, ...group.taskEvents].sort(compareCalendarEvents);

            return (
              <View key={group.key} style={styles.projectTreeCard}>
                <TouchableOpacity
                  style={styles.projectTreeHeader}
                  activeOpacity={group.projectId ? 0.88 : 1}
                  onPress={() => {
                    if (group.projectId) {
                      navigation.navigate('VolunteerProjectDetail', { projectId: group.projectId });
                    }
                  }}
                  disabled={!group.projectId}
                >
                  <View style={styles.projectTreeHeaderIcon}>
                    <Ionicons name="git-branch-outline" size={20} color={appColors.primary} />
                  </View>

                  <View style={styles.projectTreeHeaderBody}>
                    <View style={styles.projectTreeHeaderTitleRow}>
                      <Text style={styles.projectTreeTitle} numberOfLines={2}>
                        {group.title}
                      </Text>
                      {group.projectId ? (
                        <Ionicons name="chevron-forward" size={18} color={appColors.textMuted} />
                      ) : null}
                    </View>

                    <Text style={styles.projectTreeSubtitle} numberOfLines={1}>
                      {group.subtitle || group.location}
                    </Text>

                    <View style={styles.projectTreeTagsRow}>
                      {projectEventCount ? (
                        <View style={styles.projectTreeTag}>
                          <Ionicons name="flag-outline" size={12} color={appColors.primary} />
                          <Text style={styles.projectTreeTagText}>{projectEventCount} проектных событий</Text>
                        </View>
                      ) : null}

                      {taskEventCount ? (
                        <View style={styles.projectTreeTag}>
                          <Ionicons name="checkbox-outline" size={12} color={appColors.primary} />
                          <Text style={styles.projectTreeTagText}>{taskEventCount} задач</Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                </TouchableOpacity>

                <View style={styles.projectTreeChildren}>
                  {groupEvents.map((event, index) => {
                    const typeConfig = getEventTypeConfig(event.type);
                    const statusConfig = getStatusConfig(event.status);
                    const isFirst = index === 0;
                    const isLast = index === groupEvents.length - 1;

                    return (
                      <TouchableOpacity
                        key={event.id}
                        style={styles.treeEventRow}
                        activeOpacity={0.92}
                        onPress={() => navigation.navigate('CalendarEventDetail', { event })}
                      >
                        {/* Иерархические древовидные линии (Корни) */}
                        <View style={[styles.lShapeCurve, isFirst && styles.lShapeCurveFirst]} />
                        {!isLast && <View style={styles.verticalContinuation} />}

                        {/* Иконка задачи */}
                        <View style={[styles.treeEventMarker, { backgroundColor: typeConfig.softColor }]}>
                          <Ionicons name={typeConfig.icon} size={16} color={typeConfig.color} />
                        </View>

                        {/* Тело задачи */}
                        <View style={styles.treeEventBody}>
                          <View style={styles.eventHeaderRow}>
                            <Text style={styles.treeEventTitle} numberOfLines={2}>
                              {getEventNodeTitle(event)}
                            </Text>
                            {statusConfig ? (
                              <View style={[styles.statusBadge, { backgroundColor: statusConfig.backgroundColor }]}>
                                <Text style={[styles.statusBadgeText, { color: statusConfig.color }]}>{statusConfig.label}</Text>
                              </View>
                            ) : null}
                          </View>

                          <Text style={styles.treeEventSubtitle} numberOfLines={2}>
                            {event.subtitle || typeConfig.label}
                          </Text>

                          <View style={styles.eventMetaRow}>
                            <Ionicons name="time-outline" size={14} color={appColors.textMuted} />
                            <Text style={styles.eventMetaText}>{formatEventTime(event)}</Text>
                          </View>

                          <View style={styles.eventMetaRow}>
                            <Ionicons name="location-outline" size={14} color={appColors.textMuted} />
                            <Text style={styles.eventMetaText} numberOfLines={1}>
                              {getEventLocation(event)}
                            </Text>
                          </View>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            );
          })
        ) : (
          <View style={styles.emptyCard}>
            <Ionicons name="calendar-clear-outline" size={28} color={appColors.textMuted} />
            <Text style={styles.emptyTitle}>На выбранный день событий нет</Text>
            <Text style={styles.emptyText}>Переключите дату или месяц, чтобы посмотреть другие задачи и даты проектов.</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: appColors.background,
  },
  screen: {
    flex: 1,
    backgroundColor: appColors.background,
  },
  content: {
    padding: 16,
    paddingBottom: 28,
  },
  loadingScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: appColors.background,
  },
  loadingText: {
    marginTop: 12,
    color: appColors.textSoft,
    fontSize: 15,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerCaption: {
    display: 'none',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: appColors.text,
  },
  headerAction: {
    display: 'none',
  },
  calendarCard: {
    backgroundColor: appColors.surface,
    borderRadius: 26,
    padding: 18,
    borderWidth: 1,
    borderColor: appColors.border,
    shadowColor: appColors.surface,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.05,
    shadowRadius: 18,
    elevation: 4,
  },
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  monthButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: appColors.background,
  },
  monthTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: appColors.text,
    textTransform: 'capitalize',
  },
  monthTitleCompact: {
    fontSize: 18,
  },
  weekdaysRow: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  weekdayLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '700',
    color: appColors.textSoft,
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: '14.2857%',
    aspectRatio: 0.9,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'transparent',
    marginBottom: 2,
  },
  dayCellSelected: {
    borderColor: appColors.primary,
    backgroundColor: appColors.primarySurface,
  },
  dayCellMuted: {
    opacity: 0.45,
  },
  dayNumber: {
    fontSize: 16,
    fontWeight: '700',
    color: appColors.text,
  },
  dayNumberMuted: {
    color: appColors.textSoft,
  },
  dayNumberSelected: {
    color: '#047857',
  },
  dayNumberToday: {
    color: appColors.primary,
  },
  dayDotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 10,
    marginTop: 4,
  },
  dayDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    marginHorizontal: 1.5,
  },
  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 14,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 14,
    marginBottom: 8,
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
  },
  sectionHeader: {
    marginTop: 22,
    marginBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: '800',
    color: appColors.text,
    marginRight: 12,
  },
  sectionCount: {
    minWidth: 28,
    height: 28,
    borderRadius: 14,
    textAlign: 'center',
    textAlignVertical: 'center',
    fontSize: 13,
    fontWeight: '700',
    color: '#047857',
    backgroundColor: appColors.primarySurfaceStrong,
    overflow: 'hidden',
    paddingTop: 5,
  },
  projectTreeCard: {
    backgroundColor: appColors.surface,
    borderRadius: 22,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: appColors.border,
    overflow: 'hidden',
  },
  projectTreeHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    paddingBottom: 14,
    backgroundColor: '#F7FFFB',
  },
  projectTreeHeaderIcon: {
    width: 48,
    height: 48,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: appColors.primarySurface,
    marginRight: 12,
  },
  projectTreeHeaderBody: {
    flex: 1,
  },
  projectTreeHeaderTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  projectTreeTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '800',
    color: appColors.text,
    marginRight: 10,
  },
  projectTreeSubtitle: {
    fontSize: 13,
    fontWeight: '700',
    color: appColors.textSoft,
  },
  projectTreeTagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 10,
  },
  projectTreeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: appColors.surface,
    borderWidth: 1,
    borderColor: appColors.border,
    marginRight: 8,
    marginBottom: 8,
  },
  projectTreeTagText: {
    marginLeft: 5,
    fontSize: 12,
    fontWeight: '700',
    color: appColors.text,
  },
  // --- НАЧАЛО: ИЗМЕНЕННЫЕ СТИЛИ ДЛЯ ИЕРАРХИИ (ДЕРЕВА) ---
  projectTreeChildren: {
    paddingLeft: 39, // Математически высчитано: выравнивает линию ровно по центру иконки 48x48
    paddingRight: 16,
    paddingBottom: 8,
  },
  treeEventRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 14,
    position: 'relative',
  },
  lShapeCurve: {
    position: 'absolute',
    left: 0,
    top: 0,
    height: 30, // Спускаемся на 14px padding + 16px до центра иконки
    width: 22, // Тянется вправо к задаче
    borderLeftWidth: 2,
    borderBottomWidth: 2,
    borderColor: appColors.border,
    borderBottomLeftRadius: 10, // Плавное закругление веточки
  },
  lShapeCurveFirst: {
    top: -14, // Первая ветка тянется выше, чтобы закрыть разрыв с карточкой проекта
    height: 44,
  },
  verticalContinuation: {
    position: 'absolute',
    left: 0,
    top: 30, // Начинается там, где закончился изгиб L-Shape
    bottom: 0, // Уходит вниз до следующей задачи
    width: 2,
    backgroundColor: appColors.border,
  },
  treeEventMarker: {
    width: 32,
    height: 32,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 22, // Оставляем место для веточки, чтобы она "втыкалась" в иконку
    marginRight: 12,
  },
  // --- КОНЕЦ: ИЗМЕНЕННЫЕ СТИЛИ ДЛЯ ИЕРАРХИИ (ДЕРЕВА) ---
  treeEventBody: {
    flex: 1,
  },
  treeEventTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '800',
    color: appColors.text,
    marginRight: 10,
  },
  treeEventSubtitle: {
    fontSize: 13,
    fontWeight: '700',
    color: appColors.primary,
    marginBottom: 8,
  },
  eventCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: appColors.surface,
    borderRadius: 22,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: appColors.border,
  },
  eventIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  eventBody: {
    flex: 1,
  },
  eventHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  eventTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '800',
    color: appColors.text,
    marginRight: 10,
  },
  eventSubtitle: {
    fontSize: 13,
    fontWeight: '700',
    color: appColors.primary,
    marginBottom: 8,
  },
  eventMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  eventMetaText: {
    marginLeft: 6,
    fontSize: 13,
    color: appColors.textMuted,
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  emptyCard: {
    alignItems: 'center',
    backgroundColor: appColors.surface,
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: appColors.border,
  },
  emptyTitle: {
    marginTop: 12,
    marginBottom: 8,
    fontSize: 18,
    fontWeight: '800',
    color: appColors.text,
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 21,
    color: appColors.textMuted,
  },
});