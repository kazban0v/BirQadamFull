import 'package:flutter/material.dart';
import '../../theme/app_colors.dart';

/// Custom Pull to Refresh wrapper with BirQadam styling
class AppPullToRefresh extends StatelessWidget {
  final Widget child;
  final Future<void> Function() onRefresh;
  final Color? color;

  const AppPullToRefresh({
    super.key,
    required this.child,
    required this.onRefresh,
    this.color,
  });

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: onRefresh,
      color: color ?? AppColors.primary,
      backgroundColor: Colors.white,
      strokeWidth: 3.0,
      displacement: 40.0,
      child: child,
    );
  }
}


