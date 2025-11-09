// lib/models/geofence_reminder.dart

class GeofenceReminder {
  final int id;
  final String title;
  final String message;
  final double latitude;
  final double longitude;
  final int radius;
  final bool isActive;
  final bool isTriggered;
  final ProjectBasicInfo? project;
  final EventBasicInfo? event;
  final DateTime? triggeredAt;
  final DateTime createdAt;

  GeofenceReminder({
    required this.id,
    required this.title,
    required this.message,
    required this.latitude,
    required this.longitude,
    required this.radius,
    required this.isActive,
    required this.isTriggered,
    this.project,
    this.event,
    this.triggeredAt,
    required this.createdAt,
  });

  factory GeofenceReminder.fromJson(Map<String, dynamic> json) {
    return GeofenceReminder(
      id: json['id'] as int,
      title: json['title'] ?? '',
      message: json['message'] ?? '',
      latitude: json['latitude'] != null 
          ? (json['latitude'] as num).toDouble() 
          : 0.0,
      longitude: json['longitude'] != null 
          ? (json['longitude'] as num).toDouble() 
          : 0.0,
      radius: json['radius'] ?? 500,
      isActive: json['is_active'] ?? false,
      isTriggered: json['is_triggered'] ?? false,
      project: json['project'] != null
          ? ProjectBasicInfo.fromJson(json['project'])
          : null,
      event: json['event'] != null
          ? EventBasicInfo.fromJson(json['event'])
          : null,
      triggeredAt: json['triggered_at'] != null
          ? DateTime.parse(json['triggered_at'])
          : null,
      createdAt: DateTime.parse(json['created_at']),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'title': title,
      'message': message,
      'latitude': latitude,
      'longitude': longitude,
      'radius': radius,
      'is_active': isActive,
      'is_triggered': isTriggered,
      'project_id': project?.id,
      'event_id': event?.id,
      'triggered_at': triggeredAt?.toIso8601String(),
      'created_at': createdAt.toIso8601String(),
    };
  }

  String get radiusDisplay {
    if (radius >= 1000) {
      return '${(radius / 1000).toStringAsFixed(1)} км';
    }
    return '$radius м';
  }

  String get locationName {
    if (project != null) {
      return project!.title;
    }
    if (event != null) {
      return event!.title;
    }
    return title.isNotEmpty ? title : 'Локация';
  }
}

class ProjectBasicInfo {
  final int id;
  final String title;

  ProjectBasicInfo({
    required this.id,
    required this.title,
  });

  factory ProjectBasicInfo.fromJson(Map<String, dynamic> json) {
    return ProjectBasicInfo(
      id: json['id'],
      title: json['title'],
    );
  }
}

class EventBasicInfo {
  final int id;
  final String title;

  EventBasicInfo({
    required this.id,
    required this.title,
  });

  factory EventBasicInfo.fromJson(Map<String, dynamic> json) {
    return EventBasicInfo(
      id: json['id'],
      title: json['title'],
    );
  }
}

