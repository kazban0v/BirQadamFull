// lib/models/user_stats.dart

class UserStats {
  final int userId;
  final String username;
  final String name;
  final String role;
  final double currentRating;
  
  // Общая статистика
  final int projectsCount;
  final int tasksCount;
  final int completedTasksCount;
  final int photoReportsCount;
  
  // Специфичная статистика
  final int? approvedPhotosCount;  // Волонтер
  final int? achievementsCount;    // Волонтер
  final int? activeProjectsCount;  // Организатор
  final int? completedProjectsCount; // Организатор
  final int? volunteersCount;      // Организатор
  
  // Динамика рейтинга
  final List<RatingHistoryPoint> ratingHistory;

  UserStats({
    required this.userId,
    required this.username,
    required this.name,
    required this.role,
    required this.currentRating,
    required this.projectsCount,
    required this.tasksCount,
    required this.completedTasksCount,
    required this.photoReportsCount,
    this.approvedPhotosCount,
    this.achievementsCount,
    this.activeProjectsCount,
    this.completedProjectsCount,
    this.volunteersCount,
    required this.ratingHistory,
  });

  factory UserStats.fromJson(Map<String, dynamic> json) {
    final List<RatingHistoryPoint> history = [];
    
    if (json['rating_history'] != null && json['rating_history'] is List) {
      for (var point in json['rating_history']) {
        history.add(RatingHistoryPoint.fromJson(point));
      }
    }
    
    return UserStats(
      userId: json['user_id'] as int,
      username: json['username'] ?? '',
      name: json['name'] ?? '',
      role: json['role'] ?? '',
      currentRating: (json['current_rating'] as num?)?.toDouble() ?? 0.0,
      projectsCount: json['projects_count'] as int? ?? 0,
      tasksCount: json['tasks_count'] as int? ?? 0,
      completedTasksCount: json['completed_tasks_count'] as int? ?? 0,
      photoReportsCount: json['photo_reports_count'] as int? ?? 0,
      approvedPhotosCount: json['approved_photos_count'] as int?,
      achievementsCount: json['achievements_count'] as int?,
      activeProjectsCount: json['active_projects_count'] as int?,
      completedProjectsCount: json['completed_projects_count'] as int?,
      volunteersCount: json['volunteers_count'] as int?,
      ratingHistory: history,
    );
  }
}

class RatingHistoryPoint {
  final String date;
  final double rating;

  RatingHistoryPoint({
    required this.date,
    required this.rating,
  });

  factory RatingHistoryPoint.fromJson(Map<String, dynamic> json) {
    return RatingHistoryPoint(
      date: json['date'] ?? '',
      rating: (json['rating'] as num?)?.toDouble() ?? 0.0,
    );
  }
  
  DateTime get dateTime => DateTime.parse(date);
}





