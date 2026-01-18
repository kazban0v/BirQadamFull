// lib/screens/calendar_screen.dart
/// Экран календаря событий с table_calendar

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:table_calendar/table_calendar.dart';
import '../../providers/calendar_provider.dart';
import '../../models/calendar_event.dart';
import 'event_detail_screen.dart';

class CalendarScreen extends StatefulWidget {
  const CalendarScreen({super.key});

  @override
  State<CalendarScreen> createState() => _CalendarScreenState();
}

class _CalendarScreenState extends State<CalendarScreen> {
  CalendarFormat _calendarFormat = CalendarFormat.month;
  DateTime _focusedDay = DateTime.now();
  DateTime? _selectedDay;

  @override
  void initState() {
    super.initState();
    _selectedDay = _focusedDay;
    
    // Загрузить события
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final provider = Provider.of<CalendarProvider>(context, listen: false);
      provider.fetchEvents(month: _focusedDay);
    });
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      appBar: AppBar(
        title: Text(
          'Календарь',
          style: TextStyle(
            fontWeight: FontWeight.bold,
            fontSize: 20,
            color: isDark ? Colors.white : const Color(0xFF2E7D32),
          ),
        ),
        actions: [
          // Фильтр по типу
          IconButton(
            icon: const Icon(Icons.tune_rounded),
            onPressed: _showFilterDialog,
            tooltip: 'Фильтры',
          ),
          // Только предстоящие
          Consumer<CalendarProvider>(
            builder: (context, provider, _) {
              return IconButton(
                icon: Icon(
                  provider.showOnlyUpcoming
                    ? Icons.event_available_rounded
                    : Icons.event_rounded,
                  color: provider.showOnlyUpcoming
                    ? const Color(0xFF4CAF50)
                    : (isDark ? Colors.grey[400] : null),
                ),
                onPressed: () {
                  provider.setUpcomingFilter(!provider.showOnlyUpcoming);
                },
                tooltip: 'Только предстоящие',
              );
            },
          ),
        ],
      ),
      body: Consumer<CalendarProvider>(
        builder: (context, provider, _) {
          if (provider.isLoading && provider.events.isEmpty) {
            return const Center(child: CircularProgressIndicator());
          }

          return Column(
            children: [
              // Календарь
              _buildCalendar(provider),
              
              const Divider(height: 1),
              
              // Список событий выбранного дня
              Expanded(
                child: _buildEventsList(provider),
              ),
            ],
          );
        },
      ),
      // Создание событий убрано - только просмотр для волонтеров
      floatingActionButton: null,
    );
  }

  /// Календарь с маркерами событий
  Widget _buildCalendar(CalendarProvider provider) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Container(
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1E1E1E) : Colors.white,
        borderRadius: const BorderRadius.only(
          bottomLeft: Radius.circular(24),
          bottomRight: Radius.circular(24),
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.1),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: TableCalendar(
        firstDay: DateTime.utc(2020, 1, 1),
        lastDay: DateTime.utc(2030, 12, 31),
        focusedDay: _focusedDay,
        calendarFormat: _calendarFormat,
        selectedDayPredicate: (day) {
          return isSameDay(_selectedDay, day);
        },
        onDaySelected: (selectedDay, focusedDay) {
          if (!isSameDay(_selectedDay, selectedDay)) {
            setState(() {
              _selectedDay = selectedDay;
              _focusedDay = focusedDay;
            });
          }
        },
        onFormatChanged: (format) {
          if (_calendarFormat != format) {
            setState(() {
              _calendarFormat = format;
            });
          }
        },
        onPageChanged: (focusedDay) {
          _focusedDay = focusedDay;
          provider.fetchEvents(month: focusedDay);
        },
        eventLoader: (day) {
          return provider.getEventsForDay(day);
        },
        calendarStyle: CalendarStyle(
          todayDecoration: BoxDecoration(
            color: const Color(0xFF4CAF50).withValues(alpha: 0.3),
            shape: BoxShape.circle,
            border: Border.all(
              color: const Color(0xFF4CAF50),
              width: 2,
            ),
          ),
          selectedDecoration: const BoxDecoration(
            gradient: LinearGradient(
              colors: [Color(0xFF4CAF50), Color(0xFF66BB6A)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            shape: BoxShape.circle,
          ),
          markerDecoration: const BoxDecoration(
            color: Color(0xFFFF9800),
            shape: BoxShape.circle,
          ),
          markersMaxCount: 3,
          todayTextStyle: TextStyle(
            color: isDark ? Colors.white : const Color(0xFF2E7D32),
            fontWeight: FontWeight.bold,
          ),
          selectedTextStyle: const TextStyle(
            color: Colors.white,
            fontWeight: FontWeight.bold,
          ),
          defaultTextStyle: TextStyle(
            color: isDark ? Colors.white : Colors.black87,
          ),
          weekendTextStyle: TextStyle(
            color: isDark ? Colors.grey[400] : Colors.black54,
          ),
          outsideTextStyle: TextStyle(
            color: isDark ? Colors.grey[700] : Colors.grey[400],
          ),
        ),
        headerStyle: HeaderStyle(
          formatButtonVisible: true,
          titleCentered: true,
          formatButtonDecoration: BoxDecoration(
            color: const Color(0xFF4CAF50).withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(20),
            border: Border.all(
              color: const Color(0xFF4CAF50).withValues(alpha: 0.3),
            ),
          ),
          formatButtonTextStyle: const TextStyle(
            color: Color(0xFF4CAF50),
            fontWeight: FontWeight.w600,
          ),
          titleTextStyle: TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.bold,
            color: isDark ? Colors.white : const Color(0xFF2E7D32),
          ),
          leftChevronIcon: Icon(
            Icons.chevron_left_rounded,
            color: isDark ? Colors.white : const Color(0xFF4CAF50),
          ),
          rightChevronIcon: Icon(
            Icons.chevron_right_rounded,
            color: isDark ? Colors.white : const Color(0xFF4CAF50),
          ),
        ),
        daysOfWeekStyle: DaysOfWeekStyle(
          weekdayStyle: TextStyle(
            color: isDark ? Colors.grey[400] : Colors.grey[700],
            fontWeight: FontWeight.w600,
          ),
          weekendStyle: TextStyle(
            color: isDark ? Colors.grey[500] : Colors.grey[600],
            fontWeight: FontWeight.w600,
          ),
        ),
        availableCalendarFormats: const {
          CalendarFormat.month: 'Месяц',
          CalendarFormat.twoWeeks: '2 недели',
          CalendarFormat.week: 'Неделя',
        },
        locale: 'ru_RU',
      ),
    );
  }

  /// Список событий выбранного дня
  Widget _buildEventsList(CalendarProvider provider) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    if (_selectedDay == null) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              Icons.touch_app_rounded,
              size: 80,
              color: isDark ? Colors.grey[700] : Colors.grey[300],
            ),
            const SizedBox(height: 16),
            Text(
              'Выберите день в календаре',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w600,
                color: isDark ? Colors.grey[400] : Colors.grey[600],
              ),
            ),
          ],
        ),
      );
    }

    final events = provider.getEventsForDay(_selectedDay!);

    if (events.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                color: isDark
                    ? const Color(0xFF2C2C2C)
                    : const Color(0xFFF5F5F5),
                shape: BoxShape.circle,
              ),
              child: Icon(
                Icons.event_busy_rounded,
                size: 64,
                color: isDark ? Colors.grey[600] : Colors.grey[400],
              ),
            ),
            const SizedBox(height: 24),
            Text(
              'Нет событий',
              style: TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.bold,
                color: isDark ? Colors.grey[300] : Colors.grey[700],
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'На этот день событий не запланировано',
              style: TextStyle(
                fontSize: 14,
                color: isDark ? Colors.grey[500] : Colors.grey[500],
              ),
            ),
          ],
        ),
      );
    }

    return AnimatedSwitcher(
      duration: const Duration(milliseconds: 300),
      child: ListView.builder(
        key: ValueKey(_selectedDay),
        padding: const EdgeInsets.all(16),
        itemCount: events.length,
        itemBuilder: (context, index) {
          final event = events[index];
          return TweenAnimationBuilder<double>(
            tween: Tween(begin: 0.0, end: 1.0),
            duration: Duration(milliseconds: 300 + (index * 50)),
            curve: Curves.easeOutCubic,
            builder: (context, value, child) {
              return Transform.translate(
                offset: Offset(0, 20 * (1 - value)),
                child: Opacity(
                  opacity: value,
                  child: child,
                ),
              );
            },
            child: _buildEventCard(event),
          );
        },
      ),
    );
  }

  /// Карточка события
  Widget _buildEventCard(CalendarEvent event) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final eventColor = event.isPast
        ? (isDark ? Colors.grey[700]! : Colors.grey[400]!)
        : const Color(0xFF4CAF50);

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1E1E1E) : Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: eventColor.withValues(alpha: 0.3),
          width: 2,
        ),
        boxShadow: [
          BoxShadow(
            color: eventColor.withValues(alpha: 0.1),
            blurRadius: 8,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(16),
          onTap: () => _openEventDetail(event),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        gradient: event.isPast
                            ? null
                            : const LinearGradient(
                                colors: [Color(0xFF4CAF50), Color(0xFF66BB6A)],
                                begin: Alignment.topLeft,
                                end: Alignment.bottomRight,
                              ),
                        color: event.isPast
                            ? (isDark ? Colors.grey[800] : Colors.grey[300])
                            : null,
                        borderRadius: BorderRadius.circular(12),
                        boxShadow: event.isPast
                            ? null
                            : [
                                BoxShadow(
                                  color: const Color(0xFF4CAF50)
                                      .withValues(alpha: 0.3),
                                  blurRadius: 8,
                                  offset: const Offset(0, 2),
                                ),
                              ],
                      ),
                      child: Text(
                        event.typeIcon,
                        style: const TextStyle(fontSize: 24),
                      ),
                    ),
                    const SizedBox(width: 16),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            event.title,
                            style: TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.bold,
                              color: isDark ? Colors.white : Colors.black87,
                              decoration: event.isPast
                                  ? TextDecoration.lineThrough
                                  : null,
                            ),
                          ),
                          if (event.formattedTime != null) ...[
                            const SizedBox(height: 4),
                            Row(
                              children: [
                                Icon(
                                  Icons.access_time_rounded,
                                  size: 16,
                                  color: eventColor,
                                ),
                                const SizedBox(width: 6),
                                Text(
                                  event.formattedTime!,
                                  style: TextStyle(
                                    fontSize: 14,
                                    color: isDark
                                        ? Colors.grey[400]
                                        : Colors.grey[600],
                                    fontWeight: FontWeight.w500,
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ],
                      ),
                    ),
                    if (event.isParticipant)
                      Container(
                        padding: const EdgeInsets.all(8),
                        decoration: BoxDecoration(
                          color: const Color(0xFF4CAF50).withValues(alpha: 0.1),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: const Icon(
                          Icons.check_circle_rounded,
                          color: Color(0xFF4CAF50),
                          size: 24,
                        ),
                      ),
                  ],
                ),
                if (event.location.isNotEmpty ||
                    event.project != null ||
                    event.participants.isNotEmpty) ...[
                  const SizedBox(height: 16),
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: isDark
                          ? const Color(0xFF2C2C2C)
                          : const Color(0xFFF5F5F5),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Column(
                      children: [
                        if (event.location.isNotEmpty)
                          _buildInfoRow(
                            Icons.location_on_rounded,
                            event.location,
                            eventColor,
                            isDark,
                          ),
                        if (event.project != null) ...[
                          if (event.location.isNotEmpty)
                            const SizedBox(height: 8),
                          _buildInfoRow(
                            Icons.business_rounded,
                            event.project!.title,
                            eventColor,
                            isDark,
                          ),
                        ],
                        if (event.participants.isNotEmpty) ...[
                          if (event.location.isNotEmpty ||
                              event.project != null)
                            const SizedBox(height: 8),
                          _buildInfoRow(
                            Icons.group_rounded,
                            '${event.participants.length} участников',
                            eventColor,
                            isDark,
                          ),
                        ],
                      ],
                    ),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildInfoRow(
      IconData icon, String text, Color color, bool isDark) {
    return Row(
      children: [
        Icon(icon, size: 18, color: color),
        const SizedBox(width: 8),
        Expanded(
          child: Text(
            text,
            style: TextStyle(
              fontSize: 14,
              color: isDark ? Colors.grey[300] : Colors.grey[700],
              fontWeight: FontWeight.w500,
            ),
          ),
        ),
      ],
    );
  }

  /// Открыть детали события
  void _openEventDetail(CalendarEvent event) {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => EventDetailScreen(eventId: event.id),
      ),
    ).then((_) {
      // Обновить события после возврата
      final provider = Provider.of<CalendarProvider>(context, listen: false);
      provider.fetchEvents(month: _focusedDay);
    });
  }


  /// Диалог фильтров
  void _showFilterDialog() {
    showDialog(
      context: context,
      builder: (context) {
        return AlertDialog(
          title: const Text('Фильтры'),
          content: Consumer<CalendarProvider>(
            builder: (context, provider, _) {
              return Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  // Фильтр по типу
                  DropdownButtonFormField<String?>(
                    initialValue: provider.selectedEventType,
                    decoration: const InputDecoration(labelText: 'Тип события'),
                    items: const [
                      DropdownMenuItem(value: null, child: Text('Все')),
                      DropdownMenuItem(value: 'project_start', child: Text('🚀 Начало проекта')),
                      DropdownMenuItem(value: 'project_end', child: Text('🎯 Завершение проекта')),
                      DropdownMenuItem(value: 'task_deadline', child: Text('⏰ Дедлайн задачи')),
                      DropdownMenuItem(value: 'meeting', child: Text('👥 Встреча')),
                      DropdownMenuItem(value: 'reminder', child: Text('🔔 Напоминание')),
                      DropdownMenuItem(value: 'custom', child: Text('📅 Свое событие')),
                    ],
                    onChanged: (value) {
                      provider.setEventTypeFilter(value);
                    },
                  ),
                ],
              );
            },
          ),
          actions: [
            TextButton(
              onPressed: () {
                final provider = Provider.of<CalendarProvider>(context, listen: false);
                provider.clearFilters();
                Navigator.pop(context);
              },
              child: const Text('Сбросить'),
            ),
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Закрыть'),
            ),
          ],
        );
      },
    );
  }
}

