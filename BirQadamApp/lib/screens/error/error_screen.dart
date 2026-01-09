import 'package:flutter/material.dart';
import 'package:permission_handler/permission_handler.dart';

/// Универсальная страница ошибок с современным дизайном
class ErrorScreen extends StatelessWidget {
  final String imagePath;
  final String title;
  final String message;
  final List<ErrorAction> actions;

  const ErrorScreen({
    Key? key,
    required this.imagePath,
    required this.title,
    required this.message,
    this.actions = const [],
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    final size = MediaQuery.of(context).size;
    
    return Scaffold(
      body: Stack(
        children: [
          // Изображение на весь экран как фон
          Positioned.fill(
            child: Hero(
              tag: imagePath,
              child: Image.asset(
                imagePath,
                fit: BoxFit.cover, // Заполняет весь экран
                width: double.infinity,
                height: double.infinity,
              ),
            ),
          ),
          
          // Полупрозрачный оверлей для читаемости текста
          Positioned.fill(
            child: Container(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [
                    Colors.black.withValues(alpha: 0.3),
                    Colors.black.withValues(alpha: 0.6),
                  ],
                ),
              ),
            ),
          ),
          
          // Контент поверх изображения
          SafeArea(
            child: Padding(
              padding: EdgeInsets.symmetric(
                horizontal: size.width * 0.06,
                vertical: size.height * 0.03,
              ),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [

                  // Заголовок
                  Text(
                    title,
                    style: TextStyle(
                      fontSize: size.width * 0.07,
                      fontWeight: FontWeight.bold,
                      color: Colors.white,
                      letterSpacing: -0.5,
                      shadows: [
                        Shadow(
                          color: Colors.black.withValues(alpha: 0.3),
                          blurRadius: 8,
                          offset: const Offset(0, 2),
                        ),
                      ],
                    ),
                    textAlign: TextAlign.center,
                  ),
                  SizedBox(height: size.height * 0.015),

                  // Описание
                  Text(
                    message,
                    style: TextStyle(
                      fontSize: size.width * 0.04,
                      color: Colors.white.withValues(alpha: 0.95),
                      height: 1.5,
                      letterSpacing: 0.2,
                      shadows: [
                        Shadow(
                          color: const Color.fromARGB(255, 255, 255, 255).withValues(alpha: 0.3),
                          blurRadius: 6,
                          offset: const Offset(0, 1),
                        ),
                      ],
                    ),
                    textAlign: TextAlign.center,
                  ),
                  
                  SizedBox(height: size.height * 0.04),

                  // Кнопки действий
                  if (actions.isNotEmpty)
                    Column(
                      children: actions.asMap().entries.map((entry) {
                        final index = entry.key;
                        final action = entry.value;
                        return TweenAnimationBuilder<double>(
                          tween: Tween(begin: 0.0, end: 1.0),
                          duration: Duration(milliseconds: 300 + (index * 100)),
                          curve: Curves.easeOutCubic,
                          builder: (context, value, child) {
                            return Opacity(
                              opacity: value,
                              child: Transform.translate(
                                offset: Offset(0, 20 * (1 - value)),
                                child: child,
                              ),
                            );
                          },
                          child: Padding(
                            padding: const EdgeInsets.only(bottom: 12),
                            child: SizedBox(
                              width: double.infinity,
                              child: _buildActionButton(context, action),
                            ),
                          ),
                        );
                      }).toList(),
                    ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildActionButton(BuildContext context, ErrorAction action) {
    switch (action.type) {
      case ErrorActionType.primary:
        return _AnimatedButton(
          onPressed: action.onPressed,
          child: Container(
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [Color(0xFF4CAF50), Color(0xFF66BB6A)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(16),
              boxShadow: [
                BoxShadow(
                  color: const Color(0xFF4CAF50).withValues(alpha: 0.3),
                  blurRadius: 12,
                  offset: const Offset(0, 6),
                ),
              ],
            ),
            padding: const EdgeInsets.symmetric(vertical: 16),
            child: Center(
              child: Text(
                action.text,
                style: const TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w600,
                  color: Colors.white,
                  letterSpacing: 0.3,
                ),
              ),
            ),
          ),
        );

      case ErrorActionType.secondary:
        return _AnimatedButton(
          onPressed: action.onPressed,
          child: Container(
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(
                color: const Color(0xFF4CAF50),
                width: 2,
              ),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.05),
                  blurRadius: 8,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            padding: const EdgeInsets.symmetric(vertical: 16),
            child: Center(
              child: Text(
                action.text,
                style: const TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w600,
                  color: Color(0xFF4CAF50),
                  letterSpacing: 0.3,
                ),
              ),
            ),
          ),
        );

      case ErrorActionType.openSettings:
        return _AnimatedButton(
          onPressed: () async {
            await openAppSettings();
          },
          child: Container(
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [Color(0xFF2196F3), Color(0xFF42A5F5)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(16),
              boxShadow: [
                BoxShadow(
                  color: const Color(0xFF2196F3).withValues(alpha: 0.3),
                  blurRadius: 12,
                  offset: const Offset(0, 6),
                ),
              ],
            ),
            padding: const EdgeInsets.symmetric(vertical: 16),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(
                  Icons.settings_rounded,
                  size: 20,
                  color: Colors.white,
                ),
                const SizedBox(width: 10),
                Text(
                  action.text,
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w600,
                    color: Colors.white,
                    letterSpacing: 0.3,
                  ),
                ),
              ],
            ),
          ),
        );

      case ErrorActionType.retry:
        return _AnimatedButton(
          onPressed: action.onPressed,
          child: Container(
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [Color(0xFFFF9800), Color(0xFFFFA726)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(16),
              boxShadow: [
                BoxShadow(
                  color: const Color(0xFFFF9800).withValues(alpha: 0.3),
                  blurRadius: 12,
                  offset: const Offset(0, 6),
                ),
              ],
            ),
            padding: const EdgeInsets.symmetric(vertical: 16),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(
                  Icons.refresh_rounded,
                  size: 20,
                  color: Colors.white,
                ),
                const SizedBox(width: 10),
                Text(
                  action.text,
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w600,
                    color: Colors.white,
                    letterSpacing: 0.3,
                  ),
                ),
              ],
            ),
          ),
        );
    }
  }
}

/// Виджет анимированной кнопки с эффектом нажатия
class _AnimatedButton extends StatefulWidget {
  final VoidCallback? onPressed;
  final Widget child;

  const _AnimatedButton({
    required this.onPressed,
    required this.child,
  });

  @override
  State<_AnimatedButton> createState() => _AnimatedButtonState();
}

class _AnimatedButtonState extends State<_AnimatedButton>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _scaleAnimation;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 150),
    );
    _scaleAnimation = Tween<double>(begin: 1.0, end: 0.95).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeInOut),
    );
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTapDown: (_) => _controller.forward(),
      onTapUp: (_) {
        _controller.reverse();
        widget.onPressed?.call();
      },
      onTapCancel: () => _controller.reverse(),
      child: ScaleTransition(
        scale: _scaleAnimation,
        child: widget.child,
      ),
    );
  }
}

/// Тип действия для страницы ошибок
enum ErrorActionType {
  primary,
  secondary,
  openSettings,
  retry,
}

/// Действие на странице ошибок
class ErrorAction {
  final String text;
  final VoidCallback? onPressed;
  final ErrorActionType type;

  const ErrorAction({
    required this.text,
    this.onPressed,
    this.type = ErrorActionType.primary,
  });
}

/// Предустановленные экраны ошибок
class ErrorScreens {
  /// 404 - Страница не найдена
  static Widget notFound({
    VoidCallback? onBack,
  }) {
    return ErrorScreen(
      imagePath: 'assets/images/errors/404_error.png',
      title: 'Страница не найдена',
      message: 'Кажется, эта страница не существует или была удалена.',
      actions: [
        if (onBack != null)
          ErrorAction(
            text: 'Вернуться назад',
            onPressed: onBack,
          ),
      ],
    );
  }

  /// Нет интернета
  static Widget noInternet({
    required VoidCallback onRetry,
    VoidCallback? onClose,
  }) {
    return ErrorScreen(
      imagePath: 'assets/images/errors/Connection_Lost.png',
      title: 'Нет подключения к интернету',
      message: 'Проверьте подключение к сети и повторите попытку.',
      actions: [
        ErrorAction(
          text: 'Повторить',
          onPressed: onRetry,
          type: ErrorActionType.retry,
        ),
        if (onClose != null)
          ErrorAction(
            text: 'Закрыть',
            onPressed: onClose,
            type: ErrorActionType.secondary,
          ),
      ],
    );
  }

  /// Геолокация не получена
  static Widget noLocation({
    VoidCallback? onClose,
  }) {
    return ErrorScreen(
      imagePath: 'assets/images/errors/location_error.png',
      title: 'Геолокация не получена',
      message:
          'Разрешите доступ к геолокации в настройках, чтобы видеть карту проектов.',
      actions: [
        ErrorAction(
          text: 'Открыть настройки',
          type: ErrorActionType.openSettings,
        ),
        if (onClose != null)
          ErrorAction(
            text: 'Отмена',
            onPressed: onClose,
            type: ErrorActionType.secondary,
          ),
      ],
    );
  }

  /// Доступ к камере отклонен
  static Widget noCameraAccess({
    VoidCallback? onClose,
  }) {
    return ErrorScreen(
      imagePath: 'assets/images/errors/no_camera_access.png',
      title: 'Доступ к камере отклонен',
      message:
          'Разрешите доступ к камере в настройках, чтобы делать фотоотчеты.',
      actions: [
        ErrorAction(
          text: 'Открыть настройки',
          type: ErrorActionType.openSettings,
        ),
        if (onClose != null)
          ErrorAction(
            text: 'Отмена',
            onPressed: onClose,
            type: ErrorActionType.secondary,
          ),
      ],
    );
  }

  /// Недостаточно места в памяти
  static Widget notEnoughStorage({
    VoidCallback? onClose,
  }) {
    return ErrorScreen(
      imagePath: 'assets/images/errors/storage_not_enough.png',
      title: 'Недостаточно места',
      message:
          'Недостаточно места в памяти устройства. Освободите место и попробуйте снова.',
      actions: [
        ErrorAction(
          text: 'Открыть настройки',
          type: ErrorActionType.openSettings,
        ),
        if (onClose != null)
          ErrorAction(
            text: 'Закрыть',
            onPressed: onClose,
            type: ErrorActionType.secondary,
          ),
      ],
    );
  }

  /// Пустой результат поиска
  static Widget noSearchResults({
    required String query,
    VoidCallback? onClear,
  }) {
    return ErrorScreen(
      imagePath: 'assets/images/errors/no_search_result.png',
      title: 'Ничего не найдено',
      message:
          'По запросу "$query" ничего не найдено. Попробуйте изменить параметры поиска.',
      actions: [
        if (onClear != null)
          ErrorAction(
            text: 'Очистить фильтры',
            onPressed: onClear,
          ),
      ],
    );
  }

  /// Ошибка загрузки данных
  static Widget loadError({
    required VoidCallback onRetry,
    VoidCallback? onClose,
  }) {
    return ErrorScreen(
      imagePath: 'assets/images/errors/Connection_Lost.png',
      title: 'Ошибка загрузки',
      message:
          'Не удалось загрузить данные. Проверьте подключение к интернету.',
      actions: [
        ErrorAction(
          text: 'Повторить',
          onPressed: onRetry,
          type: ErrorActionType.retry,
        ),
        if (onClose != null)
          ErrorAction(
            text: 'Закрыть',
            onPressed: onClose,
            type: ErrorActionType.secondary,
          ),
      ],
    );
  }
}