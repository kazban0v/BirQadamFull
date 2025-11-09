import 'package:flutter/material.dart';
import '../../theme/app_colors.dart';
import '../../theme/app_text_styles.dart';

enum AppButtonType {
  primary,
  secondary,
  success,
  warning,
  error,
  outline,
}

enum AppButtonSize {
  small,
  medium,
  large,
}

/// Улучшенная кнопка с анимациями, hover эффектами и плавными переходами
class AppButton extends StatefulWidget {
  final String text;
  final VoidCallback? onPressed;
  final AppButtonType type;
  final AppButtonSize size;
  final bool isLoading;
  final bool isDisabled;
  final IconData? icon;
  final bool fullWidth;

  const AppButton({
    super.key,
    required this.text,
    this.onPressed,
    this.type = AppButtonType.primary,
    this.size = AppButtonSize.medium,
    this.isLoading = false,
    this.isDisabled = false,
    this.icon,
    this.fullWidth = false,
  });

  @override
  State<AppButton> createState() => _AppButtonState();
}

class _AppButtonState extends State<AppButton>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _scaleAnimation;
  bool _isPressed = false;
  bool _isHovered = false;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      duration: const Duration(milliseconds: 150),
      vsync: this,
    );
    _scaleAnimation = Tween<double>(begin: 1.0, end: 0.97).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeInOut),
    );
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _handleTapDown(TapDownDetails details) {
    if (!widget.isDisabled && !widget.isLoading) {
      setState(() => _isPressed = true);
      _controller.forward();
    }
  }

  void _handleTapUp(TapUpDetails details) {
    if (!widget.isDisabled && !widget.isLoading) {
      setState(() => _isPressed = false);
      _controller.reverse();
    }
  }

  void _handleTapCancel() {
    if (!widget.isDisabled && !widget.isLoading) {
      setState(() => _isPressed = false);
      _controller.reverse();
    }
  }

  Color _getBackgroundColor() {
    if (widget.isDisabled) {
      return AppColors.textHint.withValues(alpha: 0.6);
    }

    Color baseColor;
    switch (widget.type) {
      case AppButtonType.primary:
        baseColor = AppColors.primary;
        break;
      case AppButtonType.secondary:
        baseColor = AppColors.surface;
        break;
      case AppButtonType.success:
        baseColor = AppColors.success;
        break;
      case AppButtonType.warning:
        baseColor = AppColors.warning;
        break;
      case AppButtonType.error:
        baseColor = AppColors.error;
        break;
      case AppButtonType.outline:
        return Colors.transparent;
    }

    // Hover эффект: немного светлее
    if (_isHovered && !_isPressed) {
      return Color.lerp(baseColor, Colors.white, 0.1) ?? baseColor;
    }

    // Pressed эффект: немного темнее
    if (_isPressed) {
      return Color.lerp(baseColor, Colors.black, 0.15) ?? baseColor;
    }

    return baseColor;
  }

  Color _getForegroundColor() {
    if (widget.isDisabled) {
      return AppColors.textSecondary.withValues(alpha: 0.7);
    }

    switch (widget.type) {
      case AppButtonType.primary:
      case AppButtonType.success:
      case AppButtonType.warning:
      case AppButtonType.error:
        return Colors.white;
      case AppButtonType.secondary:
        return AppColors.primary;
      case AppButtonType.outline:
        return AppColors.primary;
    }
  }

  BorderSide _getBorderSide() {
    if (widget.type == AppButtonType.outline) {
      final borderColor = widget.isDisabled
          ? AppColors.textHint.withValues(alpha: 0.5)
          : (_isHovered ? AppColors.primaryLight : AppColors.primary);
      return BorderSide(
        color: borderColor,
        width: _isHovered ? 2.0 : 1.5,
      );
    }
    return BorderSide.none;
  }

  EdgeInsets _getPadding() {
    switch (widget.size) {
      case AppButtonSize.small:
        return const EdgeInsets.symmetric(horizontal: 12, vertical: 8);
      case AppButtonSize.medium:
        return const EdgeInsets.symmetric(horizontal: 16, vertical: 12);
      case AppButtonSize.large:
        return const EdgeInsets.symmetric(horizontal: 24, vertical: 16);
    }
  }

  TextStyle _getTextStyle() {
    switch (widget.size) {
      case AppButtonSize.small:
        return AppTextStyles.buttonSmall;
      case AppButtonSize.medium:
      case AppButtonSize.large:
        return AppTextStyles.button;
    }
  }

  double _getBorderRadius() {
    switch (widget.size) {
      case AppButtonSize.small:
        return 8;
      case AppButtonSize.medium:
        return 12;
      case AppButtonSize.large:
        return 16;
    }
  }

  List<BoxShadow> _getShadows() {
    if (widget.type == AppButtonType.outline || widget.isDisabled) {
      return [];
    }

    final baseColor = _getBackgroundColor();
    final shadowColor = baseColor.withValues(alpha: 0.4);

    // Hover: более выраженная тень
    if (_isHovered && !_isPressed) {
      return [
        BoxShadow(
          color: shadowColor,
          blurRadius: 12,
          offset: const Offset(0, 6),
          spreadRadius: 1,
        ),
      ];
    }

    // Pressed: меньше тени
    if (_isPressed) {
      return [
        BoxShadow(
          color: shadowColor.withValues(alpha: 0.2),
          blurRadius: 4,
          offset: const Offset(0, 2),
        ),
      ];
    }

    // Normal: стандартная тень
    return [
      BoxShadow(
        color: shadowColor.withValues(alpha: 0.3),
        blurRadius: 8,
        offset: const Offset(0, 4),
        spreadRadius: 0,
      ),
    ];
  }

  @override
  Widget build(BuildContext context) {
    final button = MouseRegion(
      onEnter: (_) => setState(() => _isHovered = true),
      onExit: (_) => setState(() => _isHovered = false),
      child: GestureDetector(
        onTapDown: _handleTapDown,
        onTapUp: _handleTapUp,
        onTapCancel: _handleTapCancel,
        onTap: (widget.isDisabled || widget.isLoading)
            ? null
            : widget.onPressed,
        child: ScaleTransition(
          scale: _scaleAnimation,
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 200),
            curve: Curves.easeInOut,
            width: widget.fullWidth ? double.infinity : null,
            padding: _getPadding(),
            decoration: BoxDecoration(
              color: _getBackgroundColor(),
              borderRadius: BorderRadius.circular(_getBorderRadius()),
              border: widget.type == AppButtonType.outline
                  ? Border.all(
                      color: _getBorderSide().color,
                      width: _getBorderSide().width,
                    )
                  : null,
              boxShadow: _getShadows(),
            ),
            child: Row(
              mainAxisSize: widget.fullWidth ? MainAxisSize.max : MainAxisSize.min,
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                if (widget.isLoading) ...[
                  SizedBox(
                    width: widget.size == AppButtonSize.small ? 12 : 16,
                    height: widget.size == AppButtonSize.small ? 12 : 16,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      valueColor: AlwaysStoppedAnimation<Color>(
                        _getForegroundColor(),
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                ] else if (widget.icon != null) ...[
                  Icon(
                    widget.icon,
                    size: widget.size == AppButtonSize.small ? 16 : 20,
                    color: _getForegroundColor(),
                  ),
                  const SizedBox(width: 8),
                ],
                Text(
                  widget.text,
                  style: _getTextStyle().copyWith(
                    color: _getForegroundColor(),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );

    return button;
  }
}