class Activity {
  final int id;
  final String type;
  final String title;
  final String description;
  final DateTime createdAt;
  final String? projectName;

  Activity({
    required this.id,
    required this.type,
    required this.title,
    required this.description,
    required this.createdAt,
    this.projectName,
  });

  factory Activity.fromJson(Map<String, dynamic> json) {
    return Activity(
      id: json['id'] as int,
      type: json['type'] as String,
      title: json['title'] as String,
      description: json['description'] as String,
      createdAt: DateTime.parse(json['created_at'] as String),
      projectName: json['project_name'] as String?,
    );
  }

  String get timeAgo {
    final now = DateTime.now();
    final difference = now.difference(createdAt);

    if (difference.inDays > 7) {
      return '${difference.inDays ~/ 7} ${_pluralWeeks(difference.inDays ~/ 7)} назад';
    } else if (difference.inDays > 0) {
      return '${difference.inDays} ${_pluralDays(difference.inDays)} назад';
    } else if (difference.inHours > 0) {
      return '${difference.inHours} ${_pluralHours(difference.inHours)} назад';
    } else if (difference.inMinutes > 0) {
      return '${difference.inMinutes} ${_pluralMinutes(difference.inMinutes)} назад';
    } else {
      return 'Только что';
    }
  }

  String _pluralDays(int count) {
    if (count % 10 == 1 && count % 100 != 11) {
      return 'день';
    } else if ([2, 3, 4].contains(count % 10) && ![12, 13, 14].contains(count % 100)) {
      return 'дня';
    } else {
      return 'дней';
    }
  }

  String _pluralHours(int count) {
    if (count % 10 == 1 && count % 100 != 11) {
      return 'час';
    } else if ([2, 3, 4].contains(count % 10) && ![12, 13, 14].contains(count % 100)) {
      return 'часа';
    } else {
      return 'часов';
    }
  }

  String _pluralMinutes(int count) {
    if (count % 10 == 1 && count % 100 != 11) {
      return 'минуту';
    } else if ([2, 3, 4].contains(count % 10) && ![12, 13, 14].contains(count % 100)) {
      return 'минуты';
    } else {
      return 'минут';
    }
  }

  String _pluralWeeks(int count) {
    if (count % 10 == 1 && count % 100 != 11) {
      return 'неделю';
    } else if ([2, 3, 4].contains(count % 10) && ![12, 13, 14].contains(count % 100)) {
      return 'недели';
    } else {
      return 'недель';
    }
  }
}
