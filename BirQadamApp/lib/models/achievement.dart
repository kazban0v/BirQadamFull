class Achievement {
  final int id;
  final String name;
  final String description;
  final int xp;
  final bool isUnlocked;
  final String icon;
  final DateTime? unlockedAt;
  final int requiredRating; // Порог рейтинга для разблокировки

  Achievement({
    required this.id,
    required this.name,
    required this.description,
    required this.xp,
    required this.isUnlocked,
    required this.icon,
    this.unlockedAt,
    this.requiredRating = 0, // По умолчанию 0
  });

  factory Achievement.fromJson(Map<String, dynamic> json) {
    return Achievement(
      id: json['id'] as int,
      name: json['name'] as String,
      description: json['description'] as String,
      xp: json['xp'] as int,
      isUnlocked: json['is_unlocked'] as bool,
      icon: json['icon'] as String,
      unlockedAt: json['unlocked_at'] != null
          ? DateTime.parse(json['unlocked_at'] as String)
          : null,
      requiredRating: json['required_rating'] as int? ?? 0,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'description': description,
      'xp': xp,
      'is_unlocked': isUnlocked,
      'icon': icon,
      'unlocked_at': unlockedAt?.toIso8601String(),
      'required_rating': requiredRating,
    };
  }
}

class UserProgress {
  final int currentXp;
  final int nextLevelXp;
  final String currentLevel;
  final String nextLevel;
  final double progressPercent;

  UserProgress({
    required this.currentXp,
    required this.nextLevelXp,
    required this.currentLevel,
    required this.nextLevel,
    required this.progressPercent,
  });

  factory UserProgress.fromJson(Map<String, dynamic> json) {
    return UserProgress(
      currentXp: json['current_xp'] as int,
      nextLevelXp: json['next_level_xp'] as int,
      currentLevel: json['current_level'] as String,
      nextLevel: json['next_level'] as String,
      progressPercent: (json['progress_percent'] as num).toDouble(),
    );
  }
}
