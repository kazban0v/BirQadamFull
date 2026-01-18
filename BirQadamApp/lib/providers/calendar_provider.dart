// lib/providers/calendar_provider.dart
/// Provider для управления календарем событий

import 'package:flutter/material.dart';
import 'dart:convert';
import '../models/calendar_event.dart';
import '../config/app_config.dart';
import 'auth_provider.dart';
import '../services/api/auth_http_client.dart';

class CalendarProvider extends ChangeNotifier {
  final AuthProvider _authProvider;
  late final AuthHttpClient _httpClient;

  CalendarProvider(this._authProvider) {
    _httpClient = AuthHttpClient(_authProvider);
  }

  // ==================== СОСТОЯНИЕ ====================
  
  List<CalendarEvent> _events = [];
  bool _isLoading = false;
  String? _error;
  
  // Фильтры
  DateTime? _selectedMonth;
  String? _selectedEventType;
  int? _selectedProjectId;
  bool _showOnlyUpcoming = false;

  // ==================== ГЕТТЕРЫ ====================
  
  List<CalendarEvent> get events => _events;
  bool get isLoading => _isLoading;
  String? get error => _error;
  DateTime? get selectedMonth => _selectedMonth;
  String? get selectedEventType => _selectedEventType;
  int? get selectedProjectId => _selectedProjectId;
  bool get showOnlyUpcoming => _showOnlyUpcoming;

  /// События для конкретной даты
  List<CalendarEvent> getEventsForDay(DateTime day) {
    return _events.where((event) {
      return event.startDate.year == day.year &&
          event.startDate.month == day.month &&
          event.startDate.day == day.day;
    }).toList();
  }

  /// Количество событий в день (для маркера в календаре)
  int getEventCountForDay(DateTime day) {
    return getEventsForDay(day).length;
  }

  /// Есть ли события в день
  bool hasEventsOnDay(DateTime day) {
    return getEventsForDay(day).isNotEmpty;
  }

  /// Предстоящие события (ближайшие 7 дней)
  List<CalendarEvent> get upcomingEvents {
    final now = DateTime.now();
    final sevenDaysLater = now.add(const Duration(days: 7));
    
    return _events.where((event) {
      return event.startDate.isAfter(now) && event.startDate.isBefore(sevenDaysLater);
    }).toList()
      ..sort((a, b) => a.startDate.compareTo(b.startDate));
  }

  /// События сегодня
  List<CalendarEvent> get todayEvents {
    final now = DateTime.now();
    return getEventsForDay(now);
  }

  // ==================== МЕТОДЫ ====================

  /// Загрузить события
  Future<void> fetchEvents({
    DateTime? month,
    String? eventType,
    int? projectId,
    bool? upcoming,
  }) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      // Формирование query параметров
      final queryParams = <String, String>{};
      
      if (month != null) {
        queryParams['month'] = '${month.year}-${month.month.toString().padLeft(2, '0')}';
      }
      
      if (eventType != null && eventType.isNotEmpty) {
        queryParams['type'] = eventType;
      }
      
      if (projectId != null) {
        queryParams['project_id'] = projectId.toString();
      }
      
      if (upcoming != null && upcoming) {
        queryParams['upcoming'] = 'true';
      }

      final uri = Uri.parse('${AppConfig.customAdminApiUrl}/calendar/events/').replace(
        queryParameters: queryParams.isEmpty ? null : queryParams,
      );

      final response = await _httpClient.get(uri);

      if (response.statusCode == 200) {
        final data = json.decode(utf8.decode(response.bodyBytes));
        
        if (data['success'] == true) {
          final eventsJson = data['events'] as List<dynamic>;
          _events = eventsJson.map((e) => CalendarEvent.fromJson(e)).toList();
          _error = null;
        } else {
          _error = data['error'] ?? 'Ошибка загрузки событий';
          _events = [];
        }
      } else {
        _error = 'Ошибка сервера: ${response.statusCode}';
        _events = [];
      }
    } catch (e) {
      _error = 'Ошибка: $e';
      _events = [];
      debugPrint('❌ Error fetching events: $e');
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  /// Создать новое событие
  Future<bool> createEvent({
    required String title,
    required DateTime startDate,
    String? description,
    String? eventType,
    String? startTime,
    DateTime? endDate,
    String? endTime,
    bool? isAllDay,
    String? location,
    String? visibility,
    int? reminderMinutes,
    int? projectId,
    int? taskId,
    List<int>? participantIds,
  }) async {
    try {
      final uri = Uri.parse('${AppConfig.customAdminApiUrl}/calendar/events/');

      final body = {
        'title': title,
        'start_date': startDate.toIso8601String(),
        if (description != null) 'description': description,
        if (eventType != null) 'event_type': eventType,
        if (startTime != null) 'start_time': startTime,
        if (endDate != null) 'end_date': endDate.toIso8601String(),
        if (endTime != null) 'end_time': endTime,
        if (isAllDay != null) 'is_all_day': isAllDay,
        if (location != null) 'location': location,
        if (visibility != null) 'visibility': visibility,
        if (reminderMinutes != null) 'reminder_minutes': reminderMinutes,
        if (projectId != null) 'project_id': projectId,
        if (taskId != null) 'task_id': taskId,
        if (participantIds != null) 'participant_ids': participantIds,
      };

      final response = await _httpClient.post(
        uri,
        headers: {'Content-Type': 'application/json'},
        body: json.encode(body),
      );

      if (response.statusCode == 201) {
        final data = json.decode(utf8.decode(response.bodyBytes));
        if (data['success'] == true) {
          // Перезагрузить события
          await fetchEvents(month: _selectedMonth);
          return true;
        }
      }
      
      return false;
    } catch (e) {
      debugPrint('❌ Error creating event: $e');
      return false;
    }
  }

  /// Обновить событие
  Future<bool> updateEvent({
    required int eventId,
    String? title,
    String? description,
    String? eventType,
    DateTime? startDate,
    String? startTime,
    DateTime? endDate,
    String? endTime,
    bool? isAllDay,
    String? location,
    String? visibility,
    int? reminderMinutes,
    int? projectId,
    int? taskId,
    List<int>? participantIds,
  }) async {
    try {
      final uri = Uri.parse('${AppConfig.customAdminApiUrl}/calendar/events/$eventId/');

      final body = <String, dynamic>{};
      if (title != null) body['title'] = title;
      if (description != null) body['description'] = description;
      if (eventType != null) body['event_type'] = eventType;
      if (startDate != null) body['start_date'] = startDate.toIso8601String();
      if (startTime != null) body['start_time'] = startTime;
      if (endDate != null) body['end_date'] = endDate.toIso8601String();
      if (endTime != null) body['end_time'] = endTime;
      if (isAllDay != null) body['is_all_day'] = isAllDay;
      if (location != null) body['location'] = location;
      if (visibility != null) body['visibility'] = visibility;
      if (reminderMinutes != null) body['reminder_minutes'] = reminderMinutes;
      if (projectId != null) body['project_id'] = projectId;
      if (taskId != null) body['task_id'] = taskId;
      if (participantIds != null) body['participant_ids'] = participantIds;

      final response = await _httpClient.put(
        uri,
        headers: {'Content-Type': 'application/json'},
        body: json.encode(body),
      );

      if (response.statusCode == 200) {
        final data = json.decode(utf8.decode(response.bodyBytes));
        if (data['success'] == true) {
          // Перезагрузить события
          await fetchEvents(month: _selectedMonth);
          return true;
        }
      }
      
      return false;
    } catch (e) {
      debugPrint('❌ Error updating event: $e');
      return false;
    }
  }

  /// Удалить событие
  Future<bool> deleteEvent(int eventId) async {
    try {
      final uri = Uri.parse('${AppConfig.customAdminApiUrl}/calendar/events/$eventId/');

      final response = await _httpClient.delete(uri);

      if (response.statusCode == 200) {
        final data = json.decode(utf8.decode(response.bodyBytes));
        if (data['success'] == true) {
          // Удалить из локального списка
          _events.removeWhere((e) => e.id == eventId);
          notifyListeners();
          return true;
        }
      }
      
      return false;
    } catch (e) {
      debugPrint('❌ Error deleting event: $e');
      return false;
    }
  }

  /// Присоединиться к событию
  Future<bool> joinEvent(int eventId) async {
    try {
      final uri = Uri.parse('${AppConfig.customAdminApiUrl}/calendar/events/$eventId/participants/');

      final response = await _httpClient.post(
        uri,
        headers: {'Content-Type': 'application/json'},
        body: json.encode({'action': 'join'}),
      );

      if (response.statusCode == 200) {
        final data = json.decode(utf8.decode(response.bodyBytes));
        if (data['success'] == true) {
          // Перезагрузить события
          await fetchEvents(month: _selectedMonth);
          return true;
        }
      }
      
      return false;
    } catch (e) {
      debugPrint('❌ Error joining event: $e');
      return false;
    }
  }

  /// Покинуть событие
  Future<bool> leaveEvent(int eventId) async {
    try {
      final uri = Uri.parse('${AppConfig.customAdminApiUrl}/calendar/events/$eventId/participants/');

      final response = await _httpClient.post(
        uri,
        headers: {'Content-Type': 'application/json'},
        body: json.encode({'action': 'leave'}),
      );

      if (response.statusCode == 200) {
        final data = json.decode(utf8.decode(response.bodyBytes));
        if (data['success'] == true) {
          // Перезагрузить события
          await fetchEvents(month: _selectedMonth);
          return true;
        }
      }
      
      return false;
    } catch (e) {
      debugPrint('❌ Error leaving event: $e');
      return false;
    }
  }

  /// Получить детали события
  Future<CalendarEvent?> getEventDetails(int eventId) async {
    try {
      final uri = Uri.parse('${AppConfig.customAdminApiUrl}/calendar/events/$eventId/');

      final response = await _httpClient.get(uri);

      if (response.statusCode == 200) {
        final data = json.decode(utf8.decode(response.bodyBytes));
        
        if (data['success'] == true) {
          return CalendarEvent.fromJson(data['event']);
        }
      }
      
      return null;
    } catch (e) {
      debugPrint('❌ Error fetching event details: $e');
      return null;
    }
  }

  // ==================== ФИЛЬТРЫ ====================

  /// Установить фильтр по месяцу
  void setMonthFilter(DateTime month) {
    _selectedMonth = month;
    fetchEvents(month: month);
  }

  /// Установить фильтр по типу события
  void setEventTypeFilter(String? eventType) {
    _selectedEventType = eventType;
    fetchEvents(
      month: _selectedMonth,
      eventType: eventType,
      projectId: _selectedProjectId,
      upcoming: _showOnlyUpcoming,
    );
  }

  /// Установить фильтр по проекту
  void setProjectFilter(int? projectId) {
    _selectedProjectId = projectId;
    fetchEvents(
      month: _selectedMonth,
      eventType: _selectedEventType,
      projectId: projectId,
      upcoming: _showOnlyUpcoming,
    );
  }

  /// Показывать только предстоящие
  void setUpcomingFilter(bool upcoming) {
    _showOnlyUpcoming = upcoming;
    
    // ✅ ФИКС: Когда включаем фильтр "предстоящие", НЕ передаем month
    // Иначе бэкенд фильтрует по месяцу И по upcoming, что конфликтует
    if (upcoming) {
      fetchEvents(
        eventType: _selectedEventType,
        projectId: _selectedProjectId,
        upcoming: true,
      );
    } else {
      // Когда выключаем фильтр, возвращаемся к месячному виду
      fetchEvents(
        month: _selectedMonth ?? DateTime.now(),
        eventType: _selectedEventType,
        projectId: _selectedProjectId,
        upcoming: false,
      );
    }
  }

  /// Сбросить все фильтры
  void clearFilters() {
    _selectedMonth = null;
    _selectedEventType = null;
    _selectedProjectId = null;
    _showOnlyUpcoming = false;
    fetchEvents();
  }

  /// Очистить состояние
  void clear() {
    _events = [];
    _isLoading = false;
    _error = null;
    _selectedMonth = null;
    _selectedEventType = null;
    _selectedProjectId = null;
    _showOnlyUpcoming = false;
    notifyListeners();
  }
}

