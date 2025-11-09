import 'package:flutter/material.dart';
import '../../theme/app_colors.dart';

/// BirQadam logo with mountain landscape design
/// Supports both image asset and custom painted fallback
class BirQadamLogo extends StatelessWidget {
  final double size;
  final bool showShadow;
  final bool useImage; // Toggle between image and custom paint

  const BirQadamLogo({
    super.key,
    this.size = 200,
    this.showShadow = true,
    this.useImage = true, // Try to use image by default
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        boxShadow: showShadow
            ? [
                BoxShadow(
                  color: AppColors.primary.withValues(alpha: 0.3),
                  blurRadius: 20,
                  spreadRadius: 2,
                  offset: const Offset(0, 8),
                ),
              ]
            : null,
      ),
      child: ClipOval(
        child: useImage
            ? _buildImageLogo()
            : _buildCustomPaintLogo(),
      ),
    );
  }

  /// Build logo from image asset
  Widget _buildImageLogo() {
    return Image.asset(
      'assets/images/logo_birqadam.png',
      width: size,
      height: size,
      fit: BoxFit.cover,
      errorBuilder: (context, error, stackTrace) {
        // Fallback to custom painted logo if image not found
        return _buildCustomPaintLogo();
      },
    );
  }

  /// Build custom painted logo (fallback)
  Widget _buildCustomPaintLogo() {
    return Container(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [
            AppColors.primaryLight,
            AppColors.primary,
          ],
        ),
      ),
      child: Stack(
        alignment: Alignment.center,
        children: [
          // Custom painted logo with mountain, forest, river
          CustomPaint(
            size: Size(size, size),
            painter: _BirQadamLogoPainter(),
          ),
          // BirQadam text
          Positioned(
            top: size * 0.15,
            child: Text(
              'BirQadam',
              style: TextStyle(
                fontSize: size * 0.11,
                fontWeight: FontWeight.bold,
                color: Colors.white,
                letterSpacing: 1.5,
                shadows: [
                  Shadow(
                    color: Colors.black.withValues(alpha: 0.3),
                    blurRadius: 4,
                    offset: const Offset(0, 2),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Custom painter for BirQadam logo
class _BirQadamLogoPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final centerX = size.width / 2;
    final centerY = size.height / 2;

    // Draw river (flowing from bottom)
    final riverPaint = Paint()
      ..color = Colors.blue.shade200.withValues(alpha: 0.6)
      ..style = PaintingStyle.fill;

    final riverPath = Path()
      ..moveTo(centerX - 30, size.height)
      ..quadraticBezierTo(
        centerX - 20,
        centerY + 40,
        centerX - 15,
        centerY + 10,
      )
      ..quadraticBezierTo(
        centerX - 10,
        centerY - 20,
        centerX,
        centerY - 30,
      )
      ..lineTo(centerX + 10, centerY - 30)
      ..quadraticBezierTo(
        centerX + 20,
        centerY - 20,
        centerX + 25,
        centerY + 10,
      )
      ..quadraticBezierTo(
        centerX + 30,
        centerY + 40,
        centerX + 40,
        size.height,
      )
      ..close();

    canvas.drawPath(riverPath, riverPaint);

    // Draw forest (trees on left and right)
    final forestPaint = Paint()
      ..color = Colors.green.shade700.withValues(alpha: 0.7)
      ..style = PaintingStyle.fill;

    // Left trees
    _drawTree(canvas, centerX - 60, centerY + 20, 20, forestPaint);
    _drawTree(canvas, centerX - 70, centerY + 35, 15, forestPaint);
    _drawTree(canvas, centerX - 50, centerY + 35, 18, forestPaint);

    // Right trees
    _drawTree(canvas, centerX + 60, centerY + 20, 20, forestPaint);
    _drawTree(canvas, centerX + 70, centerY + 35, 15, forestPaint);
    _drawTree(canvas, centerX + 50, centerY + 35, 18, forestPaint);

    // Draw mountain (main feature)
    final mountainPaint = Paint()
      ..color = Colors.white.withValues(alpha: 0.9)
      ..style = PaintingStyle.fill;

    final mountainPath = Path()
      ..moveTo(centerX - 50, centerY + 10)
      ..lineTo(centerX - 10, centerY - 40)
      ..lineTo(centerX + 10, centerY - 50)
      ..lineTo(centerX + 50, centerY + 10)
      ..close();

    canvas.drawPath(mountainPath, mountainPaint);

    // Draw mountain shadow
    final shadowPaint = Paint()
      ..color = Colors.grey.shade400.withValues(alpha: 0.5)
      ..style = PaintingStyle.fill;

    final shadowPath = Path()
      ..moveTo(centerX + 10, centerY - 50)
      ..lineTo(centerX + 50, centerY + 10)
      ..lineTo(centerX - 10, centerY + 10)
      ..close();

    canvas.drawPath(shadowPath, shadowPaint);

    // Draw snow cap on mountain
    final snowPaint = Paint()
      ..color = Colors.white
      ..style = PaintingStyle.fill;

    final snowPath = Path()
      ..moveTo(centerX - 5, centerY - 35)
      ..lineTo(centerX + 10, centerY - 50)
      ..lineTo(centerX + 15, centerY - 40)
      ..lineTo(centerX + 5, centerY - 35)
      ..close();

    canvas.drawPath(snowPath, snowPaint);
  }

  void _drawTree(Canvas canvas, double x, double y, double height, Paint paint) {
    // Tree trunk
    final trunkPaint = Paint()
      ..color = Colors.brown.shade600.withValues(alpha: 0.7)
      ..style = PaintingStyle.fill;

    canvas.drawRect(
      Rect.fromLTWH(x - 2, y, 4, height * 0.4),
      trunkPaint,
    );

    // Tree foliage (triangle)
    final foliagePath = Path()
      ..moveTo(x, y - height * 0.6)
      ..lineTo(x - height * 0.4, y)
      ..lineTo(x + height * 0.4, y)
      ..close();

    canvas.drawPath(foliagePath, paint);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
