import 'package:flutter/material.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:geolocator/geolocator.dart';
import '../../l10n/app_localizations.dart';
import '../../theme/app_colors.dart';
import '../error/error_screen.dart';

/// Экран 4: Разрешение на геолокацию
class LocationPermissionScreen extends StatefulWidget {
  const LocationPermissionScreen({super.key});

  @override
  State<LocationPermissionScreen> createState() => _LocationPermissionScreenState();
}

class _LocationPermissionScreenState extends State<LocationPermissionScreen> {
  bool _permissionGranted = false;

  @override
  void initState() {
    super.initState();
    // Автоматически запрашиваем разрешение при загрузке экрана
    // ✅ Увеличена задержка до 1500ms для предотвращения конфликта с notification permission
    Future.delayed(const Duration(milliseconds: 1500), () {
      if (mounted) {
        _requestLocationPermission();
      }
    });
  }

  Future<void> _requestLocationPermission() async {
    try {
      print('📍 Запрашиваем разрешение на геолокацию...');
      
      // Проверяем, включена ли геолокация на устройстве
      bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
      if (!serviceEnabled) {
        print('⚠️ Сервис геолокации выключен');
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('⚠️ Пожалуйста, включите геолокацию в настройках'),
              backgroundColor: AppColors.warning,
            ),
          );
        }
        return;
      }

      // Запрашиваем разрешение
      final status = await Permission.location.request();
      print('📊 Статус разрешения на геолокацию: $status');

      if (status.isGranted) {
        print('✅ Разрешение на геолокацию получено');
        
        // ✅ Проверяем mounted ПЕРЕД setState
        if (!mounted) return;
        
        setState(() {
          _permissionGranted = true;
        });
        
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('✅ Геолокация включена'),
              backgroundColor: AppColors.success,
            ),
          );
        }
      } else if (status.isDenied) {
        print('⚠️ Пользователь отклонил разрешение');
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('⚠️ Разрешение на геолокацию отклонено'),
              backgroundColor: AppColors.warning,
            ),
          );
        }
      } else if (status.isPermanentlyDenied) {
        print('❌ Разрешение отклонено навсегда');
        // Показываем полноценный экран ошибки вместо простого открытия настроек
        if (mounted) {
          Navigator.push(
            context,
            MaterialPageRoute(
              builder: (_) => ErrorScreens.noLocation(
                onClose: () => Navigator.pop(context),
              ),
            ),
          );
        }
      }
    } catch (e) {
      print('❌ Ошибка запроса разрешения на геолокацию: $e');
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    return SingleChildScrollView(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 24.0, vertical: 60.0),
        child: Column(
          children: [
            // Title
            Text(
              l10n.t('onboarding_community_title'),
              textAlign: TextAlign.center,
              style: const TextStyle(
                fontSize: 24,
                color: Colors.white,
                fontWeight: FontWeight.bold,
                height: 1.3,
              ),
            ),

            const SizedBox(height: 32),

            // Community circles with people avatars
            SizedBox(
              height: 200,
              child: Stack(
                alignment: Alignment.center,
                children: [
                  // Background circle
                  Container(
                    width: 180,
                    height: 180,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: Colors.white.withValues(alpha: 0.1),
                    border: Border.all(
                      color: Colors.white.withValues(alpha: 0.3),
                      width: 2,
                    ),
                  ),
                ),

                // Center avatar (You)
                _CommunityAvatar(
                  icon: Icons.person,
                  color: AppColors.primary,
                  size: 60,
                  label: l10n.t('you'),
                  top: 70,
                  left: 125,
                ),

                // Top avatars
                const _CommunityAvatar(
                  icon: Icons.person,
                  color: AppColors.accent,
                  size: 50,
                  top: 10,
                  left: 115,
                ),

                // Top-left
                const _CommunityAvatar(
                  icon: Icons.person,
                  color: AppColors.success,
                  size: 45,
                  top: 25,
                  left: 40,
                ),

                // Top-right
                const _CommunityAvatar(
                  icon: Icons.person,
                  color: AppColors.warning,
                  size: 45,
                  top: 25,
                  right: 40,
                ),

                // Middle-left
                const _CommunityAvatar(
                  icon: Icons.person,
                  color: AppColors.accentLight,
                  size: 40,
                  top: 85,
                  left: 15,
                ),

                // Middle-right
                const _CommunityAvatar(
                  icon: Icons.person,
                  color: AppColors.successLight,
                  size: 40,
                  top: 85,
                  right: 15,
                ),

                // Bottom-left
                const _CommunityAvatar(
                  icon: Icons.person,
                  color: AppColors.primaryLight,
                  size: 38,
                  bottom: 30,
                  left: 50,
                ),

                // Bottom-right
                const _CommunityAvatar(
                  icon: Icons.person,
                  color: AppColors.info,
                  size: 38,
                  bottom: 30,
                  right: 50,
                ),
              ],
            ),
          ),

          const SizedBox(height: 24),

          // Description
          Text(
            l10n.t('onboarding_community_desc'),
            textAlign: TextAlign.center,
            style: const TextStyle(
              fontSize: 18,
              color: Colors.white,
              fontWeight: FontWeight.w500,
              height: 1.5,
            ),
          ),

          const SizedBox(height: 32),

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
                    l10n.t('onboarding_location_enabled'),
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
      ),
    );
  }
}

/// Community avatar widget with circular photo
class _CommunityAvatar extends StatelessWidget {
  final IconData icon;
  final Color color;
  final double size;
  final String? label;
  final double? top;
  final double? left;
  final double? right;
  final double? bottom;

  const _CommunityAvatar({
    required this.icon,
    required this.color,
    required this.size,
    this.label,
    this.top,
    this.left,
    this.right,
    this.bottom,
  });

  @override
  Widget build(BuildContext context) {
    return Positioned(
      top: top,
      left: left,
      right: right,
      bottom: bottom,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: size,
            height: size,
            decoration: BoxDecoration(
              color: color,
              shape: BoxShape.circle,
              border: Border.all(color: Colors.white, width: 3),
              boxShadow: [
                BoxShadow(
                  color: color.withValues(alpha: 0.4),
                  blurRadius: 15,
                  spreadRadius: 2,
                ),
              ],
            ),
            child: Icon(
              icon,
              color: Colors.white,
              size: size * 0.5,
            ),
          ),
          if (label != null) ...[
            const SizedBox(height: 4),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(8),
              ),
              child: Text(
                label!,
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.bold,
                  color: color,
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

