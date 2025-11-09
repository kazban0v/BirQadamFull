import 'package:flutter/material.dart';

/// Универсальный компонент для отображения пустых состояний
class EmptyState extends StatelessWidget {
  final IconData icon;
  final String title;
  final String message;
  final String? actionText;
  final VoidCallback? onAction;
  final Color? iconColor;

  const EmptyState({
    Key? key,
    required this.icon,
    required this.title,
    required this.message,
    this.actionText,
    this.onAction,
    this.iconColor,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            // Иконка
            Container(
              width: 120,
              height: 120,
              decoration: BoxDecoration(
                color: (iconColor ?? const Color(0xFF4CAF50)).withValues(alpha: 0.1),
                shape: BoxShape.circle,
              ),
              child: Icon(
                icon,
                size: 64,
                color: iconColor ?? const Color(0xFF4CAF50),
              ),
            ),
            const SizedBox(height: 24),

            // Заголовок
            Text(
              title,
              style: const TextStyle(
                fontSize: 22,
                fontWeight: FontWeight.bold,
                color: Color(0xFF212121),
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 12),

            // Описание
            Text(
              message,
              style: TextStyle(
                fontSize: 16,
                color: Colors.grey[600],
                height: 1.5,
              ),
              textAlign: TextAlign.center,
            ),

            // Кнопка действия (опционально)
            if (actionText != null && onAction != null) ...[
              const SizedBox(height: 32),
              ElevatedButton(
                onPressed: onAction,
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF4CAF50),
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(
                    horizontal: 32,
                    vertical: 16,
                  ),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                  elevation: 0,
                ),
                child: Text(
                  actionText!,
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

/// Предустановленные варианты Empty States
class EmptyStates {
  /// Нет проектов
  static Widget noProjects({VoidCallback? onCreateProject}) {
    return EmptyState(
      icon: Icons.folder_open_rounded,
      title: 'Нет проектов',
      message: 'Пока нет доступных проектов для участия. Проверьте позже или создайте свой проект.',
      actionText: onCreateProject != null ? 'Создать проект' : null,
      onAction: onCreateProject,
    );
  }

  /// Нет задач
  static Widget noTasks() {
    return const EmptyState(
      icon: Icons.assignment_outlined,
      title: 'Нет задач',
      message: 'У вас пока нет назначенных задач. Присоединитесь к проекту, чтобы начать помогать.',
    );
  }

  /// Нет фотоотчётов
  static Widget noPhotoReports() {
    return const EmptyState(
      icon: Icons.photo_library_outlined,
      title: 'Нет фотоотчётов',
      message: 'Вы ещё не отправили ни одного фотоотчёта. Выполните задачу и загрузите фото!',
    );
  }

  /// Результаты поиска не найдены
  static Widget noSearchResults({required String query}) {
    return EmptyState(
      icon: Icons.search_off_rounded,
      title: 'Ничего не найдено',
      message: 'По запросу "$query" ничего не найдено. Попробуйте изменить параметры поиска.',
      iconColor: Colors.grey[600],
    );
  }

  /// Нет участников
  static Widget noParticipants() {
    return const EmptyState(
      icon: Icons.people_outline_rounded,
      title: 'Нет участников',
      message: 'В этом проекте пока нет участников. Будьте первым!',
    );
  }

  /// Ошибка загрузки
  static Widget loadError({required VoidCallback onRetry}) {
    return EmptyState(
      icon: Icons.error_outline_rounded,
      title: 'Ошибка загрузки',
      message: 'Не удалось загрузить данные. Проверьте подключение к интернету.',
      actionText: 'Повторить',
      onAction: onRetry,
      iconColor: Colors.red[400],
    );
  }

  /// Нет уведомлений
  static Widget noNotifications() {
    return const EmptyState(
      icon: Icons.notifications_none_rounded,
      title: 'Нет уведомлений',
      message: 'У вас нет новых уведомлений. Мы сообщим, когда появится что-то важное.',
    );
  }

  /// Нет достижений
  static Widget noAchievements() {
    return const EmptyState(
      icon: Icons.emoji_events_outlined,
      title: 'Нет достижений',
      message: 'Участвуйте в проектах и выполняйте задачи, чтобы получать достижения!',
    );
  }

  /// Нет фильтров
  static Widget noFilterResults({VoidCallback? onClearFilters}) {
    return EmptyState(
      icon: Icons.filter_list_off_rounded,
      title: 'Нет результатов',
      message: 'По выбранным фильтрам ничего не найдено. Попробуйте изменить условия поиска.',
      actionText: onClearFilters != null ? 'Сбросить фильтры' : null,
      onAction: onClearFilters,
      iconColor: Colors.orange[400],
    );
  }
}
