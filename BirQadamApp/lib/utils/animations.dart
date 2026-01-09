/// ✅ UI/UX: Анимации для карточек и переходов
import 'package:flutter/material.dart';

class AppAnimations {
  /// Fade In анимация с задержкой
  static Widget fadeIn({
    required Widget child,
    Duration duration = const Duration(milliseconds: 500),
    Duration delay = Duration.zero,
    Curve curve = Curves.easeInOut,
  }) {
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0.0, end: 1.0),
      duration: duration,
      curve: curve,
      builder: (context, value, child) {
        return Opacity(
          opacity: value,
          child: child,
        );
      },
      child: child,
    );
  }

  /// Slide In анимация (снизу вверх)
  static Widget slideInUp({
    required Widget child,
    Duration duration = const Duration(milliseconds: 400),
    Duration delay = Duration.zero,
    Curve curve = Curves.easeOut,
  }) {
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 50.0, end: 0.0),
      duration: duration,
      curve: curve,
      builder: (context, value, child) {
        return Transform.translate(
          offset: Offset(0, value),
          child: Opacity(
            opacity: 1 - (value / 50),
            child: child,
          ),
        );
      },
      child: child,
    );
  }

  /// Slide In анимация (слева направо)
  static Widget slideInLeft({
    required Widget child,
    Duration duration = const Duration(milliseconds: 400),
    Duration delay = Duration.zero,
    Curve curve = Curves.easeOut,
  }) {
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: -50.0, end: 0.0),
      duration: duration,
      curve: curve,
      builder: (context, value, child) {
        return Transform.translate(
          offset: Offset(value, 0),
          child: Opacity(
            opacity: 1 - (value.abs() / 50),
            child: child,
          ),
        );
      },
      child: child,
    );
  }

  /// Scale + Fade анимация (bounce эффект)
  static Widget scaleIn({
    required Widget child,
    Duration duration = const Duration(milliseconds: 500),
    Duration delay = Duration.zero,
    Curve curve = Curves.elasticOut,
  }) {
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0.8, end: 1.0),
      duration: duration,
      curve: curve,
      builder: (context, value, child) {
        return Transform.scale(
          scale: value,
          child: Opacity(
            opacity: value,
            child: child,
          ),
        );
      },
      child: child,
    );
  }

  /// Shimmer эффект для загрузки
  static Widget shimmer({
    required Widget child,
    Duration duration = const Duration(milliseconds: 1500),
  }) {
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: -2.0, end: 2.0),
      duration: duration,
      curve: Curves.linear,
      builder: (context, value, child) {
        return ShaderMask(
          shaderCallback: (bounds) {
            return LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: const [
                Colors.white10,
                Colors.white38,
                Colors.white10,
              ],
              stops: [
                (value - 1).clamp(0.0, 1.0),
                value.clamp(0.0, 1.0),
                (value + 1).clamp(0.0, 1.0),
              ],
            ).createShader(bounds);
          },
          child: child,
        );
      },
      child: child,
    );
  }

  /// Анимированная карточка с задержкой для списков
  static Widget listItemAnimation({
    required Widget child,
    required int index,
    Duration baseDelay = const Duration(milliseconds: 50),
  }) {
    return TweenAnimationBuilder<double>(
      key: ValueKey(index),
      tween: Tween(begin: 0.0, end: 1.0),
      duration: const Duration(milliseconds: 400),
      curve: Curves.easeOut,
      builder: (context, value, child) {
        return Transform.translate(
          offset: Offset(0, 30 * (1 - value)),
          child: Opacity(
            opacity: value,
            child: child,
          ),
        );
      },
      child: child,
    );
  }

  /// Bounce анимация для кнопок
  static Widget bounceButton({
    required Widget child,
    VoidCallback? onTap,
  }) {
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 1.0, end: 1.0),
      duration: const Duration(milliseconds: 100),
      builder: (context, value, child) {
        return Transform.scale(
          scale: value,
          child: GestureDetector(
            onTapDown: (_) {
              // Можно добавить состояние для анимации
            },
            onTapUp: (_) {
              if (onTap != null) onTap();
            },
            child: child,
          ),
        );
      },
      child: child,
    );
  }

  /// Rotate анимация
  static Widget rotate({
    required Widget child,
    Duration duration = const Duration(milliseconds: 500),
    double begin = 0.0,
    double end = 1.0,
  }) {
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: begin, end: end),
      duration: duration,
      curve: Curves.easeInOut,
      builder: (context, value, child) {
        return Transform.rotate(
          angle: value * 2 * 3.14159,
          child: child,
        );
      },
      child: child,
    );
  }

  /// Анимация появления снизу (для модальных окон)
  static Widget modalSlideUp({
    required Widget child,
    Duration duration = const Duration(milliseconds: 300),
  }) {
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 1.0, end: 0.0),
      duration: duration,
      curve: Curves.easeOut,
      builder: (context, value, child) {
        return Transform.translate(
          offset: Offset(0, MediaQuery.of(context).size.height * value),
          child: child,
        );
      },
      child: child,
    );
  }
}

/// Расширение для удобного применения анимаций
extension AnimatedWidget on Widget {
  /// Применить fade-in анимацию
  Widget fadeIn({
    Duration duration = const Duration(milliseconds: 500),
    Duration delay = Duration.zero,
  }) {
    return AppAnimations.fadeIn(
      child: this,
      duration: duration,
      delay: delay,
    );
  }

  /// Применить slide-up анимацию
  Widget slideInUp({
    Duration duration = const Duration(milliseconds: 400),
    Duration delay = Duration.zero,
  }) {
    return AppAnimations.slideInUp(
      child: this,
      duration: duration,
      delay: delay,
    );
  }

  /// Применить slide-left анимацию
  Widget slideInLeft({
    Duration duration = const Duration(milliseconds: 400),
    Duration delay = Duration.zero,
  }) {
    return AppAnimations.slideInLeft(
      child: this,
      duration: duration,
      delay: delay,
    );
  }

  /// Применить scale-in анимацию
  Widget scaleIn({
    Duration duration = const Duration(milliseconds: 500),
    Duration delay = Duration.zero,
  }) {
    return AppAnimations.scaleIn(
      child: this,
      duration: duration,
      delay: delay,
    );
  }
}





