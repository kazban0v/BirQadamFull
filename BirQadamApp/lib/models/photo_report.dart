class PhotoReport {
  final int id;
  final String volunteerName;
  final int volunteerId;
  final String taskText;
  final int? taskId;
  final String projectTitle;
  final int projectId;
  final String imageUrl;
  final String volunteerComment;  // Комментарий волонтёра
  final String organizerComment;  // Комментарий организатора
  final String rejectionReason;   // Причина отклонения
  final String status; // 'pending', 'approved', 'rejected'
  final int? rating;
  final DateTime uploadedAt;
  final DateTime? moderatedAt;
  final List<PhotoData>? photos; // Для галереи всех фото

  PhotoReport({
    required this.id,
    required this.volunteerName,
    required this.volunteerId,
    required this.taskText,
    this.taskId,
    required this.projectTitle,
    required this.projectId,
    required this.imageUrl,
    required this.volunteerComment,
    required this.organizerComment,
    required this.rejectionReason,
    required this.status,
    this.rating,
    required this.uploadedAt,
    this.moderatedAt,
    this.photos,
  });

  factory PhotoReport.fromJson(Map<String, dynamic> json) {
    return PhotoReport(
      id: json['id'] as int,
      volunteerName: json['volunteer_name'] as String? ?? '',
      volunteerId: json['volunteer_id'] as int? ?? 0,
      taskText: json['task_text'] as String? ?? '',
      taskId: json['task_id'] as int?,
      projectTitle: json['project_title'] as String? ?? '',
      projectId: json['project_id'] as int? ?? 0,
      imageUrl: json['image_url'] as String? ?? '',
      volunteerComment: json['volunteer_comment'] as String? ?? '',
      organizerComment: json['organizer_comment'] as String? ?? '',
      rejectionReason: json['rejection_reason'] as String? ?? '',
      status: json['status'] as String? ?? 'pending',
      rating: json['rating'] as int?,
      uploadedAt: DateTime.parse(json['uploaded_at'] as String),
      moderatedAt: json['moderated_at'] != null
          ? DateTime.parse(json['moderated_at'] as String)
          : null,
      photos: json['photos'] != null
          ? (json['photos'] as List)
              .map((p) => PhotoData.fromJson(p as Map<String, dynamic>))
              .toList()
          : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'volunteer_name': volunteerName,
      'volunteer_id': volunteerId,
      'task_text': taskText,
      'task_id': taskId,
      'project_title': projectTitle,
      'project_id': projectId,
      'image_url': imageUrl,
      'volunteer_comment': volunteerComment,
      'organizer_comment': organizerComment,
      'rejection_reason': rejectionReason,
      'status': status,
      'rating': rating,
      'uploaded_at': uploadedAt.toIso8601String(),
      'moderated_at': moderatedAt?.toIso8601String(),
    };
  }

  PhotoReport copyWith({
    int? id,
    String? volunteerName,
    int? volunteerId,
    String? taskText,
    int? taskId,
    String? projectTitle,
    int? projectId,
    String? imageUrl,
    String? volunteerComment,
    String? organizerComment,
    String? rejectionReason,
    String? status,
    int? rating,
    DateTime? uploadedAt,
    DateTime? moderatedAt,
    List<PhotoData>? photos,
  }) {
    return PhotoReport(
      id: id ?? this.id,
      volunteerName: volunteerName ?? this.volunteerName,
      volunteerId: volunteerId ?? this.volunteerId,
      taskText: taskText ?? this.taskText,
      taskId: taskId ?? this.taskId,
      projectTitle: projectTitle ?? this.projectTitle,
      projectId: projectId ?? this.projectId,
      imageUrl: imageUrl ?? this.imageUrl,
      volunteerComment: volunteerComment ?? this.volunteerComment,
      organizerComment: organizerComment ?? this.organizerComment,
      rejectionReason: rejectionReason ?? this.rejectionReason,
      status: status ?? this.status,
      rating: rating ?? this.rating,
      uploadedAt: uploadedAt ?? this.uploadedAt,
      moderatedAt: moderatedAt ?? this.moderatedAt,
      photos: photos ?? this.photos,
    );
  }
}

// Модель для данных фото в галерее
class PhotoData {
  final int id;
  final String imageUrl;
  final DateTime uploadedAt;

  PhotoData({
    required this.id,
    required this.imageUrl,
    required this.uploadedAt,
  });

  factory PhotoData.fromJson(Map<String, dynamic> json) {
    return PhotoData(
      id: json['id'] as int,
      imageUrl: json['image_url'] as String? ?? '',
      uploadedAt: DateTime.parse(json['uploaded_at'] as String),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'image_url': imageUrl,
      'uploaded_at': uploadedAt.toIso8601String(),
    };
  }
}