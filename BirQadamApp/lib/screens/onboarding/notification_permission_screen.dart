import 'package:flutter/material.dart';
import '../../l10n/app_localizations.dart';
import '../../theme/app_colors.dart';
import '../../services/notifications/notification_service.dart';

/// Экран 3: Примеры уведомлений (Stay in the loop)
class NotificationPermissionScreen extends StatefulWidget {
  const NotificationPermissionScreen({super.key});

  @override
  State<NotificationPermissionScreen> createState() => _NotificationPermissionScreenState();
}

class _NotificationPermissionScreenState extends State<NotificationPermissionScreen> with SingleTickerProviderStateMixin {
  bool _permissionGranted = false;
  late AnimationController _animationController;
  late Animation<double> _slideAnimation;

  @override
  void initState() {
    super.initState();
    _animationController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 800),
    );
    _slideAnimation = CurvedAnimation(
      parent: _animationController,
      curve: Curves.easeOutBack,
    );
    _animationController.forward();
    
    // Автоматически запрашиваем разрешение при загрузке экрана
    Future.delayed(const Duration(milliseconds: 500), () {
      if (mounted) {
        _requestNotificationPermission();
      }
    });
  }

  @override
  void dispose() {
    _animationController.dispose();
    super.dispose();
  }

  Future<void> _requestNotificationPermission() async {
    try {
      // Используем NotificationService вместо прямого вызова Firebase
      final granted = await NotificationService().requestNotificationPermission();

      // ✅ Проверяем mounted ПЕРЕД setState
      if (!mounted) return;

      setState(() {
        _permissionGranted = granted;
      });

      if (_permissionGranted && mounted) {
        final l10n = AppLocalizations.of(context)!;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('✅ ${l10n.t('onboarding_notifications_enabled')}'),
            backgroundColor: AppColors.success,
            duration: const Duration(seconds: 2),
          ),
        );
      } else if (!_permissionGranted && mounted) {
        final l10n = AppLocalizations.of(context)!;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('⚠️ ${l10n.t('onboarding_notifications_denied')}'),
            backgroundColor: AppColors.warning,
            duration: const Duration(seconds: 2),
          ),
        );
      }
    } catch (e) {
      debugPrint('Error requesting notification permission: $e');
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    return Padding(
      padding: const EdgeInsets.all(24.0),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          // Title
          Text(
            l10n.t('onboarding_notifications_title'),
            textAlign: TextAlign.center,
            style: const TextStyle(
              fontSize: 28,
              color: Colors.white,
              fontWeight: FontWeight.bold,
              height: 1.3,
            ),
          ),

          const SizedBox(height: 32),

          // Notification cards stack
          SlideTransition(
            position: Tween<Offset>(
              begin: const Offset(0, 0.3),
              end: Offset.zero,
            ).animate(_slideAnimation),
            child: FadeTransition(
              opacity: _slideAnimation,
              child: Column(
                children: [
                  // Notification 1: Registration completed
                  _NotificationCard(
                    icon: Icons.check_circle_outline,
                    iconColor: AppColors.success,
                    title: l10n.t('onboarding_notif_registration'),
                    subtitle: l10n.t('onboarding_notif_registration_desc'),
                    time: '2m',
                  ),

                  const SizedBox(height: 16),

                  // Notification 2: Check-in reminder
                  _NotificationCard(
                    icon: Icons.access_time,
                    iconColor: AppColors.accent,
                    title: l10n.t('onboarding_notif_checkin'),
                    subtitle: l10n.t('onboarding_notif_checkin_desc'),
                    time: '1h',
                  ),

                  const SizedBox(height: 16),

                  // Notification 3: Role offered
                  _NotificationCard(
                    icon: Icons.emoji_events,
                    iconColor: AppColors.primary,
                    title: l10n.t('onboarding_notif_role'),
                    subtitle: l10n.t('onboarding_notif_role_desc'),
                    time: '3h',
                  ),
                ],
              ),
            ),
          ),

          const SizedBox(height: 32),

          // Description
          Text(
            l10n.t('onboarding_notifications_desc'),
            textAlign: TextAlign.center,
            style: const TextStyle(
              fontSize: 18,
              color: Colors.white,
              fontWeight: FontWeight.w500,
              height: 1.5,
            ),
          ),

          const SizedBox(height: 24),

          // Success indicator
          if (_permissionGranted)
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: AppColors.success,
                borderRadius: BorderRadius.circular(16),
                boxShadow: [
                  BoxShadow(
                    color: AppColors.success.withValues(alpha: 0.4),
                    blurRadius: 20,
                    offset: const Offset(0, 8),
                  ),
                ],
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.check_circle, color: Colors.white, size: 28),
                  const SizedBox(width: 12),
                  Text(
                    l10n.t('onboarding_notifications_enabled'),
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

/// Notification card widget
class _NotificationCard extends StatelessWidget {
  final IconData icon;
  final Color iconColor;
  final String title;
  final String subtitle;
  final String time;

  const _NotificationCard({
    required this.icon,
    required this.iconColor,
    required this.title,
    required this.subtitle,
    required this.time,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.15),
            blurRadius: 20,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Row(
        children: [
          // Icon
          Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(
              color: iconColor.withValues(alpha: 0.15),
              shape: BoxShape.circle,
            ),
            child: Icon(
              icon,
              color: iconColor,
              size: 28,
            ),
          ),

          const SizedBox(width: 16),

          // Content
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Expanded(
                      child: Text(
                        title,
                        style: const TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                          color: Colors.black87,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    Text(
                      time,
                      style: TextStyle(
                        fontSize: 12,
                        color: Colors.grey[600],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                Text(
                  subtitle,
                  style: TextStyle(
                    fontSize: 14,
                    color: Colors.grey[700],
                    height: 1.3,
                  ),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
