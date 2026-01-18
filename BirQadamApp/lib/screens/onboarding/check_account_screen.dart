import 'package:flutter/material.dart';
import '../../l10n/app_localizations.dart';
import '../../theme/app_colors.dart';

/// Экран 2: Карта с маркерами (Share location)
class CheckAccountScreen extends StatelessWidget {
  const CheckAccountScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    return Padding(
      padding: const EdgeInsets.all(32.0),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          // Map illustration with markers
          Container(
            width: 300,
            height: 300,
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(24),
              boxShadow: [
                BoxShadow(
                  color: AppColors.primary.withValues(alpha: 0.3),
                  blurRadius: 30,
                  offset: const Offset(0, 10),
                ),
              ],
            ),
            child: Stack(
              children: [
                // Map background pattern
                ClipRRect(
                  borderRadius: BorderRadius.circular(24),
                  child: Container(
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                        colors: [
                          AppColors.primaryLight.withValues(alpha: 0.2),
                          Colors.white,
                          AppColors.accentLight.withValues(alpha: 0.2),
                        ],
                      ),
                    ),
                    child: CustomPaint(
                      painter: _MapPatternPainter(),
                      size: const Size(300, 300),
                    ),
                  ),
                ),
                // Location markers
                const Positioned(
                  top: 60,
                  left: 80,
                  child: _LocationMarker(color: AppColors.accent, size: 40),
                ),
                const Positioned(
                  top: 120,
                  right: 60,
                  child: _LocationMarker(color: AppColors.success, size: 36),
                ),
                const Positioned(
                  bottom: 80,
                  left: 120,
                  child: _LocationMarker(color: AppColors.primary, size: 44),
                ),
                const Positioned(
                  bottom: 100,
                  right: 80,
                  child: _LocationMarker(color: AppColors.accentLight, size: 32),
                ),
                // Center marker (user location)
                Positioned(
                  top: 130,
                  left: 130,
                  child: Container(
                    width: 50,
                    height: 50,
                    decoration: BoxDecoration(
                      color: AppColors.error,
                      shape: BoxShape.circle,
                      border: Border.all(color: Colors.white, width: 4),
                      boxShadow: [
                        BoxShadow(
                          color: AppColors.error.withValues(alpha: 0.5),
                          blurRadius: 15,
                          spreadRadius: 2,
                        ),
                      ],
                    ),
                    child: const Icon(
                      Icons.person_pin_circle,
                      color: Colors.white,
                      size: 28,
                    ),
                  ),
                ),
              ],
            ),
          ),

          const SizedBox(height: 48),

          // Title
          Text(
            l10n.t('onboarding_location_title'),
            textAlign: TextAlign.center,
            style: const TextStyle(
              fontSize: 28,
              color: Colors.white,
              fontWeight: FontWeight.bold,
              height: 1.3,
            ),
          ),

          const SizedBox(height: 16),

          // Description
          Container(
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.15),
              borderRadius: BorderRadius.circular(20),
              border: Border.all(
                color: Colors.white.withValues(alpha: 0.3),
                width: 2,
              ),
            ),
            child: Column(
              children: [
                const Icon(
                  Icons.map,
                  size: 48,
                  color: Colors.white,
                ),
                const SizedBox(height: 16),
                Text(
                  l10n.t('onboarding_location_desc'),
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    fontSize: 18,
                    color: Colors.white,
                    fontWeight: FontWeight.w500,
                    height: 1.5,
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

/// Custom painter for map pattern
class _MapPatternPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = Colors.grey.withValues(alpha: 0.2)
      ..strokeWidth = 1
      ..style = PaintingStyle.stroke;

    // Draw grid pattern
    for (double i = 0; i < size.width; i += 30) {
      canvas.drawLine(
        Offset(i, 0),
        Offset(i, size.height),
        paint,
      );
    }
    for (double i = 0; i < size.height; i += 30) {
      canvas.drawLine(
        Offset(0, i),
        Offset(size.width, i),
        paint,
      );
    }

    // Draw curved roads
    final roadPaint = Paint()
      ..color = Colors.grey.withValues(alpha: 0.3)
      ..strokeWidth = 3
      ..style = PaintingStyle.stroke;

    final path = Path()
      ..moveTo(0, size.height * 0.3)
      ..quadraticBezierTo(
        size.width * 0.3,
        size.height * 0.4,
        size.width * 0.6,
        size.height * 0.3,
      )
      ..quadraticBezierTo(
        size.width * 0.8,
        size.height * 0.25,
        size.width,
        size.height * 0.4,
      );

    canvas.drawPath(path, roadPaint);

    final path2 = Path()
      ..moveTo(size.width * 0.2, 0)
      ..quadraticBezierTo(
        size.width * 0.4,
        size.height * 0.5,
        size.width * 0.3,
        size.height,
      );

    canvas.drawPath(path2, roadPaint);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

/// Location marker widget
class _LocationMarker extends StatelessWidget {
  final Color color;
  final double size;

  const _LocationMarker({
    required this.color,
    required this.size,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: color,
        shape: BoxShape.circle,
        border: Border.all(color: Colors.white, width: 3),
        boxShadow: [
          BoxShadow(
            color: color.withValues(alpha: 0.4),
            blurRadius: 10,
            spreadRadius: 1,
          ),
        ],
      ),
      child: Icon(
        Icons.location_on,
        color: Colors.white,
        size: size * 0.6,
      ),
    );
  }
}
