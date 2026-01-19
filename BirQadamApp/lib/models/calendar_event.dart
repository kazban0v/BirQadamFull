// lib/models/calendar_event.dart
/// Модель события календаря

class CalendarEvent {
  final int id;
  final String title;
  final String description;
  final String eventType;
  final String eventTypeDisplay;
  final DateTime startDate;
  final String? startTime; // HH:mm:ss
  final DateTime? endDate;
  final String? endTime; // HH:mm:ss
  final bool isAllDay;
  final String location;
  final String visibility;
  final String? visibilityDisplay;
  final int? reminderMinutes;
  final EventCreator creator;
  final EventProject? project;
  final EventTask? task;
  final List<EventParticipant> participants;
  final bool isParticipant;
  final bool canEdit;
  final DateTime createdAt;
  final DateTime? updatedAt;

  CalendarEvent({
    required this.id,
    required this.title,
    required this.description,
    required this.eventType,
    required this.eventTypeDisplay,
    required this.startDate,
    this.startTime,
    this.endDate,
    this.endTime,
    required this.isAllDay,
    required this.location,
    required this.visibility,
    this.visibilityDisplay,
    this.reminderMinutes,
    required this.creator,
    this.project,
    this.task,
    required this.participants,
    required this.isParticipant,
    required this.canEdit,
    required this.createdAt,
    this.updatedAt,
  });

  /// Создать из JSON (GET /api/v1/calendar/events/)
  factory CalendarEvent.fromJson(Map<String, dynamic> json) {
    return CalendarEvent(
      id: json['id'],
      title: json['title'] ?? '',
      description: json['description'] ?? '',
      eventType: json['event_type'] ?? 'custom',
      eventTypeDisplay: json['event_type_display'] ?? 'Свое событие',
      startDate: DateTime.parse(json['start_date']),
      startTime: json['start_time'],
      endDate: json['end_date'] != null ? DateTime.parse(json['end_date']) : null,
      endTime: json['end_time'],
      isAllDay: json['is_all_day'] ?? false,
      location: json['location'] ?? '',
      visibility: json['visibility'] ?? 'public',
      visibilityDisplay: json['visibility_display'],
      reminderMinutes: json['reminder_minutes'],
      creator: EventCreator.fromJson(json['creator']),
      project: json['project'] != null ? EventProject.fromJson(json['project']) : null,
      task: json['task'] != null ? EventTask.fromJson(json['task']) : null,
      participants: (json['participants'] as List<dynamic>?)
              ?.map((p) => EventParticipant.fromJson(p))
              .toList() ??
          [],
      isParticipant: json['is_participant'] ?? false,
      canEdit: json['can_edit'] ?? false,
      createdAt: DateTime.parse(json['created_at']),
      updatedAt: json['updated_at'] != null ? DateTime.parse(json['updated_at']) : null,
    );
  }

  /// Проверка, прошло ли событие
  bool get isPast {
    final now = DateTime.now();
    return startDate.isBefore(DateTime(now.year, now.month, now.day));
  }

  /// Проверка, сегодня ли событие
  bool get isToday {
    final now = DateTime.now();
    return startDate.year == now.year &&
        startDate.month == now.month &&
        startDate.day == now.day;
  }

  /// Проверка, завтра ли событие
  bool get isTomorrow {
    final tomorrow = DateTime.now().add(const Duration(days: 1));
    return startDate.year == tomorrow.year &&
        startDate.month == tomorrow.month &&
        startDate.day == tomorrow.day;
  }

  /// Форматированная дата начала
  String get formattedStartDate {
    return '${startDate.day}.${startDate.month.toString().padLeft(2, '0')}.${startDate.year}';
  }

  /// Форматированное время
  String? get formattedTime {
    if (isAllDay) return 'Весь день';
    if (startTime == null) return null;
    
    final parts = startTime!.split(':');
    if (parts.length >= 2) {
      return '${parts[0]}:${parts[1]}';
    }
    return startTime;
  }

  /// Иконка типа события
  String get typeIcon {
    switch (eventType) {
      case 'project_start':
        return '🚀';
      case 'project_end':
        return '🎯';
      case 'task_deadline':
        return '⏰';
      case 'meeting':
        return '👥';
      case 'reminder':
        return '🔔';
      default:
        return '📅';
    }
  }

  /// Краткое описание
  String get shortDescription {
    if (description.isEmpty) return 'Нет описания';
    return description.length > 100 
        ? '${description.substring(0, 100)}...' 
        : description;
  }
}

/// Создатель события
class EventCreator {
  final int id;
  final String username;

  EventCreator({
    required this.id,
    required this.username,
  });

  factory EventCreator.fromJson(Map<String, dynamic> json) {
    return EventCreator(
      id: json['id'],
      username: json['username'] ?? 'Неизвестный',
    );
  }
}

/// Проект события
class EventProject {
  final int id;
  final String title;
  final String? city;

  EventProject({
    required this.id,
    required this.title,
    this.city,
  });

  factory EventProject.fromJson(Map<String, dynamic> json) {
    return EventProject(
      id: json['id'],
      title: json['title'] ?? '',
      city: json['city'],
    );
  }
}

/// Задача события
class EventTask {
  final int id;
  final String text;
  final String? status;

  EventTask({
    required this.id,
    required this.text,
    this.status,
  });

  factory EventTask.fromJson(Map<String, dynamic> json) {
    return EventTask(
      id: json['id'],
      text: json['text'] ?? '',
      status: json['status'],
    );
  }
}

/// Участник события
class EventParticipant {
  final int id;
  final String username;

  EventParticipant({
    required this.id,
    required this.username,
  });

  factory EventParticipant.fromJson(Map<String, dynamic> json) {
    return EventParticipant(
      id: json['id'],
      username: json['username'] ?? '',
    );
  }
}

