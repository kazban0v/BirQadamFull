import 'package:flutter/material.dart';
import '../../theme/app_colors.dart';

/// Animated progress bar component
class AppProgressBar extends StatefulWidget {
  final double value; // 0.0 to 1.0
  final double height;
  final Color? color;
  final Color? backgroundColor;
  final bool showPercentage;
  final BorderRadius? borderRadius;
  final Duration animationDuration;

  const AppProgressBar({
    super.key,
    required this.value,
    this.height = 8,
    this.color,
    this.backgroundColor,
    this.showPercentage = false,
    this.borderRadius,
    this.animationDuration = const Duration(milliseconds: 800),
  });

  @override
  State<AppProgressBar> createState() => _AppProgressBarState();
}

class _AppProgressBarState extends State<AppProgressBar>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _animation;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      duration: widget.animationDuration,
      vsync: this,
    );

    _animation = Tween<double>(
      begin: 0.0,
      end: widget.value.clamp(0.0, 1.0),
    ).animate(CurvedAnimation(
      parent: _controller,
      curve: Curves.easeInOut,
    ));

    _controller.forward();
  }

  @override
  void didUpdateWidget(AppProgressBar oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.value != widget.value) {
      _animation = Tween<double>(
        begin: _animation.value,
        end: widget.value.clamp(0.0, 1.0),
      ).animate(CurvedAnimation(
        parent: _controller,
        curve: Curves.easeInOut,
      ));
      _controller
        ..reset()
        ..forward();
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final progressColor = widget.color ?? AppColors.primary;
    final bgColor = widget.backgroundColor ?? Colors.grey.shade200;
    final radius = widget.borderRadius ?? BorderRadius.circular(widget.height / 2);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        AnimatedBuilder(
          animation: _animation,
          builder: (context, child) {
            return Container(
              height: widget.height,
              decoration: BoxDecoration(
                color: bgColor,
                borderRadius: radius,
              ),
              child: FractionallySizedBox(
                widthFactor: _animation.value,
                alignment: Alignment.centerLeft,
                child: Container(
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      colors: [
                        progressColor,
                        progressColor.withValues(alpha: 0.8),
                      ],
                    ),
                    borderRadius: radius,
                    boxShadow: [
                      BoxShadow(
                        color: progressColor.withValues(alpha: 0.3),
                        blurRadius: 4,
                        offset: const Offset(0, 2),
                      ),
                    ],
                  ),
                ),
              ),
            );
          },
        ),
        if (widget.showPercentage) ...[
          const SizedBox(height: 4),
          AnimatedBuilder(
            animation: _animation,
            builder: (context, child) {
              return Text(
                '${(_animation.value * 100).toInt()}%',
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: Colors.grey.shade600,
                ),
              );
            },
          ),
        ],
      ],
    );
  }
}

/// Progress bar with label and value
class LabeledProgressBar extends StatelessWidget {
  final String label;
  final double value;
  final Color? color;
  final bool showPercentage;

  const LabeledProgressBar({
    super.key,
    required this.label,
    required this.value,
    this.color,
    this.showPercentage = true,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              label,
              style: const TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w500,
              ),
            ),
            if (showPercentage)
              Text(
                '${(value * 100).toInt()}%',
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                  color: color ?? AppColors.primary,
                ),
              ),
          ],
        ),
        const SizedBox(height: 8),
        AppProgressBar(
          value: value,
          color: color,
          height: 8,
        ),
      ],
    );
  }
}


