import 'package:flutter/material.dart';

/// Компактная карточка проекта для списков
class CompactProjectCard extends StatelessWidget {
  final String title;
  final String? imageUrl;
  final String location;
  final DateTime? date;
  final int participantsCount;
  final int tasksCount;
  final VoidCallback onTap;
  final String? status;

  const CompactProjectCard({
    Key? key,
    required this.title,
    this.imageUrl,
    required this.location,
    this.date,
    required this.participantsCount,
    required this.tasksCount,
    required this.onTap,
    this.status,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
      ),
      elevation: 0,
      color: Colors.white,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Row(
            children: [
              // Изображение проекта
              ClipRRect(
                borderRadius: BorderRadius.circular(8),
                child: imageUrl != null
                    ? Image.network(
                        imageUrl!,
                        width: 80,
                        height: 80,
                        fit: BoxFit.cover,
                        errorBuilder: (context, error, stackTrace) {
                          return _buildPlaceholderImage();
                        },
                      )
                    : _buildPlaceholderImage(),
              ),
              const SizedBox(width: 12),

              // Информация о проекте
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Название проекта
                    Text(
                      title,
                      style: const TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                        color: Color(0xFF212121),
                      ),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 6),

                    // Локация
                    Row(
                      children: [
                        Icon(
                          Icons.location_on_outlined,
                          size: 14,
                          color: Colors.grey[600],
                        ),
                        const SizedBox(width: 4),
                        Expanded(
                          child: Text(
                            location,
                            style: TextStyle(
                              fontSize: 13,
                              color: Colors.grey[600],
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 6),

                    // Статистика
                    Row(
                      children: [
                        _buildInfoChip(
                          Icons.people_outline_rounded,
                          '$participantsCount',
                        ),
                        const SizedBox(width: 8),
                        _buildInfoChip(
                          Icons.assignment_outlined,
                          '$tasksCount',
                        ),
                        if (status != null) ...[
                          const SizedBox(width: 8),
                          _buildStatusBadge(status!),
                        ],
                      ],
                    ),
                  ],
                ),
              ),

              // Стрелка
              Icon(
                Icons.chevron_right_rounded,
                color: Colors.grey[400],
                size: 24,
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildPlaceholderImage() {
    return Container(
      width: 80,
      height: 80,
      decoration: BoxDecoration(
        color: const Color(0xFF4CAF50).withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(8),
      ),
      child: const Icon(
        Icons.nature_people_rounded,
        size: 40,
        color: Color(0xFF4CAF50),
      ),
    );
  }

  Widget _buildInfoChip(IconData icon, String text) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
      decoration: BoxDecoration(
        color: Colors.grey[100],
        borderRadius: BorderRadius.circular(6),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: Colors.grey[600]),
          const SizedBox(width: 4),
          Text(
            text,
            style: TextStyle(
              fontSize: 12,
              color: Colors.grey[700],
              fontWeight: FontWeight.w500,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStatusBadge(String status) {
    Color color;
    String text;

    switch (status.toLowerCase()) {
      case 'active':
        color = const Color(0xFF4CAF50);
        text = 'Активен';
        break;
      case 'upcoming':
        color = Colors.blue;
        text = 'Скоро';
        break;
      case 'completed':
        color = Colors.grey;
        text = 'Завершён';
        break;
      default:
        color = Colors.orange;
        text = status;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(6),
      ),
      child: Text(
        text,
        style: TextStyle(
          fontSize: 11,
          color: color,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}

/// Компактная карточка задачи с индикатором срочности
class CompactTaskCard extends StatelessWidget {
  final String title;
  final String? description;
  final String location;
  final DateTime? deadline;
  final String status;
  final VoidCallback onTap;
  final UrgencyLevel urgency;

  const CompactTaskCard({
    Key? key,
    required this.title,
    this.description,
    required this.location,
    this.deadline,
    required this.status,
    required this.onTap,
    this.urgency = UrgencyLevel.normal,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(
          color: _getUrgencyColor(),
          width: urgency != UrgencyLevel.normal ? 2 : 0,
        ),
      ),
      elevation: 0,
      color: Colors.white,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Container(
          padding: const EdgeInsets.all(12),
          child: Row(
            children: [
              // Индикатор срочности
              Container(
                width: 4,
                height: 60,
                decoration: BoxDecoration(
                  color: _getUrgencyColor(),
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              const SizedBox(width: 12),

              // Информация о задаче
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Заголовок и статус
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            title,
                            style: const TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.w600,
                              color: Color(0xFF212121),
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        _buildStatusBadge(),
                      ],
                    ),
                    const SizedBox(height: 6),

                    // Локация
                    Row(
                      children: [
                        Icon(
                          Icons.location_on_outlined,
                          size: 14,
                          color: Colors.grey[600],
                        ),
                        const SizedBox(width: 4),
                        Expanded(
                          child: Text(
                            location,
                            style: TextStyle(
                              fontSize: 13,
                              color: Colors.grey[600],
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      ],
                    ),

                    // Дедлайн (если есть)
                    if (deadline != null) ...[
                      const SizedBox(height: 4),
                      Row(
                        children: [
                          Icon(
                            Icons.access_time_rounded,
                            size: 14,
                            color: _getDeadlineColor(),
                          ),
                          const SizedBox(width: 4),
                          Text(
                            _formatDeadline(),
                            style: TextStyle(
                              fontSize: 12,
                              color: _getDeadlineColor(),
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ],
                ),
              ),

              // Стрелка
              Icon(
                Icons.chevron_right_rounded,
                color: Colors.grey[400],
                size: 24,
              ),
            ],
          ),
        ),
      ),
    );
  }

  Color _getUrgencyColor() {
    switch (urgency) {
      case UrgencyLevel.high:
        return Colors.red;
      case UrgencyLevel.medium:
        return Colors.orange;
      case UrgencyLevel.normal:
        return Colors.grey[300]!;
    }
  }

  Color _getDeadlineColor() {
    if (deadline == null) return Colors.grey[600]!;

    final now = DateTime.now();
    final diff = deadline!.difference(now);

    if (diff.inHours < 24) {
      return Colors.red;
    } else if (diff.inDays < 3) {
      return Colors.orange;
    } else {
      return Colors.grey[600]!;
    }
  }

  String _formatDeadline() {
    if (deadline == null) return '';

    final now = DateTime.now();
    final diff = deadline!.difference(now);

    if (diff.inHours < 1) {
      return 'Менее часа';
    } else if (diff.inHours < 24) {
      return '${diff.inHours} ч';
    } else if (diff.inDays == 1) {
      return 'Завтра';
    } else if (diff.inDays < 7) {
      return '${diff.inDays} дн';
    } else {
      return '${deadline!.day}.${deadline!.month}.${deadline!.year}';
    }
  }

  Widget _buildStatusBadge() {
    Color color;
    IconData icon;

    switch (status.toLowerCase()) {
      case 'open':
        color = Colors.blue;
        icon = Icons.radio_button_unchecked;
        break;
      case 'in_progress':
        color = Colors.orange;
        icon = Icons.pending_outlined;
        break;
      case 'completed':
        color = const Color(0xFF4CAF50);
        icon = Icons.check_circle_outline;
        break;
      case 'rejected':
        color = Colors.red;
        icon = Icons.cancel_outlined;
        break;
      default:
        color = Colors.grey;
        icon = Icons.help_outline;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Icon(
        icon,
        size: 16,
        color: color,
      ),
    );
  }
}

/// Уровень срочности задачи
enum UrgencyLevel {
  normal,
  medium,
  high,
}
