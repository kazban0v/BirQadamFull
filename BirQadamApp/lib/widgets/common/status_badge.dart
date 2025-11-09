import 'package:flutter/material.dart';
import '../../theme/app_colors.dart';
import '../../theme/app_text_styles.dart';

enum StatusType {
  open,
  inProgress,
  completed,
  failed,
  closed,
  approved,
  pending,
}

class StatusBadge extends StatelessWidget {
  final String text;
  final StatusType type;
  final bool isSmall;

  const StatusBadge({
    super.key,
    required this.text,
    required this.type,
    this.isSmall = false,
  });

  Color _getBackgroundColor() {
    switch (type) {
      case StatusType.open:
        return AppColors.statusOpen;
      case StatusType.inProgress:
        return AppColors.statusInProgress;
      case StatusType.completed:
        return AppColors.statusCompleted;
      case StatusType.failed:
        return AppColors.statusFailed;
      case StatusType.closed:
        return AppColors.statusClosed;
      case StatusType.approved:
        return AppColors.success;
      case StatusType.pending:
        return AppColors.warning;
    }
  }

  IconData? _getIcon() {
    switch (type) {
      case StatusType.open:
        return Icons.play_circle_outline;
      case StatusType.inProgress:
        return Icons.access_time;
      case StatusType.completed:
        return Icons.check_circle;
      case StatusType.failed:
        return Icons.error_outline;
      case StatusType.closed:
        return Icons.lock_clock;
      case StatusType.approved:
        return Icons.verified;
      case StatusType.pending:
        return Icons.schedule;
    }
  }

  EdgeInsets _getPadding() {
    return isSmall
        ? const EdgeInsets.symmetric(horizontal: 6, vertical: 2)
        : const EdgeInsets.symmetric(horizontal: 8, vertical: 4);
  }

  double _getBorderRadius() {
    return isSmall ? 8 : 12;
  }

  double _getIconSize() {
    return isSmall ? 12 : 14;
  }

  TextStyle _getTextStyle() {
    return isSmall ? AppTextStyles.badge : AppTextStyles.status;
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: _getPadding(),
      decoration: BoxDecoration(
        color: _getBackgroundColor(),
        borderRadius: BorderRadius.circular(_getBorderRadius()),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (_getIcon() != null) ...[
            Icon(
              _getIcon(),
              color: Colors.white,
              size: _getIconSize(),
            ),
            const SizedBox(width: 4),
          ],
          Text(
            text,
            style: _getTextStyle().copyWith(color: Colors.white),
          ),
        ],
      ),
    );
  }
}