import 'package:flutter/material.dart';
import 'package:flutter_slidable/flutter_slidable.dart';

/// Карточка задачи с swipe-действиями
class SwipeableTaskCard extends StatelessWidget {
  final Widget child;
  final VoidCallback? onView;
  final VoidCallback? onComplete;
  final VoidCallback? onDelete;
  final VoidCallback? onShare;
  final bool canComplete;
  final bool canDelete;
  final bool canShare;

  const SwipeableTaskCard({
    Key? key,
    required this.child,
    this.onView,
    this.onComplete,
    this.onDelete,
    this.onShare,
    this.canComplete = true,
    this.canDelete = false,
    this.canShare = true,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    final List<SlidableAction> startActions = [];
    final List<SlidableAction> endActions = [];

    // Левые действия (свайп вправо)
    if (canComplete && onComplete != null) {
      startActions.add(
        SlidableAction(
          onPressed: (_) => onComplete!(),
          backgroundColor: const Color(0xFF4CAF50),
          foregroundColor: Colors.white,
          icon: Icons.check_circle_rounded,
          label: 'Завершить',
          borderRadius: BorderRadius.circular(12),
        ),
      );
    }

    if (canShare && onShare != null) {
      startActions.add(
        SlidableAction(
          onPressed: (_) => onShare!(),
          backgroundColor: Colors.blue,
          foregroundColor: Colors.white,
          icon: Icons.share_rounded,
          label: 'Поделиться',
          borderRadius: BorderRadius.circular(12),
        ),
      );
    }

    // Правые действия (свайп влево)
    if (onView != null) {
      endActions.add(
        SlidableAction(
          onPressed: (_) => onView!(),
          backgroundColor: Colors.blue[700]!,
          foregroundColor: Colors.white,
          icon: Icons.visibility_rounded,
          label: 'Посмотреть',
          borderRadius: BorderRadius.circular(12),
        ),
      );
    }

    if (canDelete && onDelete != null) {
      endActions.add(
        SlidableAction(
          onPressed: (_) => onDelete!(),
          backgroundColor: Colors.red,
          foregroundColor: Colors.white,
          icon: Icons.delete_rounded,
          label: 'Удалить',
          borderRadius: BorderRadius.circular(12),
        ),
      );
    }

    // Если нет действий, возвращаем просто child
    if (startActions.isEmpty && endActions.isEmpty) {
      return child;
    }

    return Slidable(
      key: key,
      startActionPane: startActions.isNotEmpty
          ? ActionPane(
              motion: const StretchMotion(),
              children: startActions,
            )
          : null,
      endActionPane: endActions.isNotEmpty
          ? ActionPane(
              motion: const StretchMotion(),
              children: endActions,
            )
          : null,
      child: child,
    );
  }
}

/// Swipeable карточка для фотоотчётов
class SwipeablePhotoReportCard extends StatelessWidget {
  final Widget child;
  final VoidCallback? onView;
  final VoidCallback? onApprove;
  final VoidCallback? onReject;
  final VoidCallback? onDelete;
  final bool showModeratorActions;

  const SwipeablePhotoReportCard({
    Key? key,
    required this.child,
    this.onView,
    this.onApprove,
    this.onReject,
    this.onDelete,
    this.showModeratorActions = false,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    final List<SlidableAction> startActions = [];
    final List<SlidableAction> endActions = [];

    if (showModeratorActions) {
      // Действия для организатора
      if (onApprove != null) {
        startActions.add(
          SlidableAction(
            onPressed: (_) => onApprove!(),
            backgroundColor: const Color(0xFF4CAF50),
            foregroundColor: Colors.white,
            icon: Icons.check_circle_rounded,
            label: 'Одобрить',
            borderRadius: BorderRadius.circular(12),
          ),
        );
      }

      if (onReject != null) {
        endActions.add(
          SlidableAction(
            onPressed: (_) => onReject!(),
            backgroundColor: Colors.red,
            foregroundColor: Colors.white,
            icon: Icons.cancel_rounded,
            label: 'Отклонить',
            borderRadius: BorderRadius.circular(12),
          ),
        );
      }
    }

    if (onView != null) {
      endActions.add(
        SlidableAction(
          onPressed: (_) => onView!(),
          backgroundColor: Colors.blue[700]!,
          foregroundColor: Colors.white,
          icon: Icons.visibility_rounded,
          label: 'Открыть',
          borderRadius: BorderRadius.circular(12),
        ),
      );
    }

    if (onDelete != null) {
      endActions.add(
        SlidableAction(
          onPressed: (_) => onDelete!(),
          backgroundColor: Colors.red,
          foregroundColor: Colors.white,
          icon: Icons.delete_rounded,
          label: 'Удалить',
          borderRadius: BorderRadius.circular(12),
        ),
      );
    }

    if (startActions.isEmpty && endActions.isEmpty) {
      return child;
    }

    return Slidable(
      key: key,
      startActionPane: startActions.isNotEmpty
          ? ActionPane(
              motion: const StretchMotion(),
              children: startActions,
            )
          : null,
      endActionPane: endActions.isNotEmpty
          ? ActionPane(
              motion: const StretchMotion(),
              children: endActions,
            )
          : null,
      child: child,
    );
  }
}

/// Swipeable карточка для участников
class SwipeableParticipantCard extends StatelessWidget {
  final Widget child;
  final VoidCallback? onView;
  final VoidCallback? onMessage;
  final VoidCallback? onRemove;
  final bool canRemove;

  const SwipeableParticipantCard({
    Key? key,
    required this.child,
    this.onView,
    this.onMessage,
    this.onRemove,
    this.canRemove = false,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    final List<SlidableAction> startActions = [];
    final List<SlidableAction> endActions = [];

    if (onMessage != null) {
      startActions.add(
        SlidableAction(
          onPressed: (_) => onMessage!(),
          backgroundColor: Colors.blue,
          foregroundColor: Colors.white,
          icon: Icons.message_rounded,
          label: 'Сообщение',
          borderRadius: BorderRadius.circular(12),
        ),
      );
    }

    if (onView != null) {
      endActions.add(
        SlidableAction(
          onPressed: (_) => onView!(),
          backgroundColor: Colors.blue[700]!,
          foregroundColor: Colors.white,
          icon: Icons.person_rounded,
          label: 'Профиль',
          borderRadius: BorderRadius.circular(12),
        ),
      );
    }

    if (canRemove && onRemove != null) {
      endActions.add(
        SlidableAction(
          onPressed: (_) => onRemove!(),
          backgroundColor: Colors.red,
          foregroundColor: Colors.white,
          icon: Icons.person_remove_rounded,
          label: 'Удалить',
          borderRadius: BorderRadius.circular(12),
        ),
      );
    }

    if (startActions.isEmpty && endActions.isEmpty) {
      return child;
    }

    return Slidable(
      key: key,
      startActionPane: startActions.isNotEmpty
          ? ActionPane(
              motion: const StretchMotion(),
              children: startActions,
            )
          : null,
      endActionPane: endActions.isNotEmpty
          ? ActionPane(
              motion: const StretchMotion(),
              children: endActions,
            )
          : null,
      child: child,
    );
  }
}
