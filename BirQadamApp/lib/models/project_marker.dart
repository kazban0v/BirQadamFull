/// Модель маркера проекта на карте
class ProjectMarker {
  final int id;
  final String title;
  final String description;
  final double latitude;
  final double longitude;
  final String city;
  final String volunteerType;
  final DateTime? startDate;
  final DateTime? endDate;
  final int volunteersCount;
  final bool isJoined;
  final String creatorName;
  final String? creatorAvatar;
  final String status;

  ProjectMarker({
    required this.id,
    required this.title,
    required this.description,
    required this.latitude,
    required this.longitude,
    required this.city,
    required this.volunteerType,
    this.startDate,
    this.endDate,
    required this.volunteersCount,
    required this.isJoined,
    required this.creatorName,
    this.creatorAvatar,
    required this.status,
  });

  /// Создание из JSON
  factory ProjectMarker.fromJson(Map<String, dynamic> json) {
    return ProjectMarker(
      id: json['id'] as int,
      title: json['title'] as String,
      description: json['description'] as String,
      latitude: (json['latitude'] as num).toDouble(),
      longitude: (json['longitude'] as num).toDouble(),
      city: json['city'] as String,
      volunteerType: json['volunteer_type'] as String,
      startDate: json['start_date'] != null
          ? DateTime.parse(json['start_date'] as String)
          : null,
      endDate: json['end_date'] != null
          ? DateTime.parse(json['end_date'] as String)
          : null,
      volunteersCount: json['volunteers_count'] as int,
      isJoined: json['is_joined'] as bool,
      creatorName: json['creator_name'] as String,
      creatorAvatar: json['creator_avatar'] as String?,
      status: json['status'] as String,
    );
  }

  /// Преобразование в JSON
  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'title': title,
      'description': description,
      'latitude': latitude,
      'longitude': longitude,
      'city': city,
      'volunteer_type': volunteerType,
      'start_date': startDate?.toIso8601String(),
      'end_date': endDate?.toIso8601String(),
      'volunteers_count': volunteersCount,
      'is_joined': isJoined,
      'creator_name': creatorName,
      'creator_avatar': creatorAvatar,
      'status': status,
    };
  }

  /// Получить тип волонтерства на русском
  String get volunteerTypeRu {
    switch (volunteerType) {
      case 'environmental':
        return 'Экологические';
      case 'social':
        return 'Социальные';
      case 'cultural':
        return 'Культурные';
      default:
        return volunteerType;
    }
  }

  /// Получить иконку для типа волонтерства
  String get volunteerTypeIcon {
    switch (volunteerType) {
      case 'environmental':
        return '🌳';
      case 'social':
        return '🤝';
      case 'cultural':
        return '🎭';
      default:
        return '📍';
    }
  }

  /// Получить статус на русском
  String get statusRu {
    switch (status) {
      case 'pending':
        return 'Ожидает проверки';
      case 'approved':
        return 'Одобрен';
      case 'rejected':
        return 'Отклонен';
      case 'completed':
        return 'Завершен';
      default:
        return status;
    }
  }
}





