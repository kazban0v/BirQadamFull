import 'package:flutter/material.dart';

/// BirQadam Color Palette
/// Primary: Blue 🔵 | Accent: Orange 🟠 | Success: Green 🟢
class AppColors {
  // ============================================
  // ОСНОВНЫЕ ЦВЕТА БРЕНДА BirQadam
  // ============================================

  /// Основной синий цвет (Primary Blue)
  static const Color primary = Color(0xFF1976D2);        // Насыщенный синий
  static const Color primaryLight = Color(0xFF42A5F5);   // Светло-синий
  static const Color primaryDark = Color(0xFF0D47A1);    // Темно-синий

  /// Акцентный оранжевый цвет (Accent Orange)
  static const Color accent = Color(0xFFFF9800);         // Яркий оранжевый
  static const Color accentLight = Color(0xFFFFB74D);    // Светло-оранжевый
  static const Color accentDark = Color(0xFFF57C00);     // Темно-оранжевый

  // ============================================
  // СЕМАНТИЧЕСКИЕ ЦВЕТА
  // ============================================

  /// Зеленый для успеха (Success Green)
  static const Color success = Color(0xFF4CAF50);        // Зеленый успех
  static const Color successLight = Color(0xFF81C784);   // Светло-зеленый
  static const Color successDark = Color(0xFF2E7D32);    // Темно-зеленый

  /// Предупреждения (используем акцентный оранжевый)
  static const Color warning = accent;                   // Оранжевый

  /// Ошибки
  static const Color error = Color(0xFFF44336);          // Красный для ошибок
  static const Color errorLight = Color(0xFFE57373);     // Светло-красный

  /// Информация (используем primary синий)
  static const Color info = primary;                     // Синий для информации

  // ============================================
  // ФОНОВЫЕ ЦВЕТА
  // ============================================

  static const Color background = Color(0xFFFAFAFA);     // Светло-серый фон
  static const Color surface = Color(0xFFFFFFFF);        // Белый для карточек
  static const Color surfaceVariant = Color(0xFFF5F5F5); // Светло-серый вариант

  // ============================================
  // ТЕКСТОВЫЕ ЦВЕТА
  // ============================================

  static const Color textPrimary = Color(0xFF212121);    // Основной текст (темный)
  static const Color textSecondary = Color(0xFF757575);  // Вторичный текст (серый)
  static const Color textHint = Color(0xFFBDBDBD);       // Подсказки (светло-серый)
  static const Color textOnPrimary = Colors.white;       // Текст на синем фоне
  static const Color textOnAccent = Colors.white;        // Текст на оранжевом фоне

  // ============================================
  // ГРАНИЦЫ И РАЗДЕЛИТЕЛИ
  // ============================================

  static const Color border = Color(0xFFE0E0E0);         // Основные границы
  static const Color borderLight = Color(0xFFF0F0F0);    // Светлые границы
  static const Color divider = Color(0xFFE0E0E0);        // Разделители

  // ============================================
  // СТАТУСЫ ЗАДАЧ И ПРОЕКТОВ
  // ============================================

  static const Color statusOpen = success;               // Открыто - зеленый ✅
  static const Color statusInProgress = accent;          // В работе - оранжевый 🔶
  static const Color statusCompleted = primary;          // Выполнено - синий ✔️
  static const Color statusFailed = error;               // Отклонено - красный ❌
  static const Color statusClosed = Color(0xFF9E9E9E);   // Закрыто - серый ⚪

  // ============================================
  // HIGHLIGHTS И АКЦЕНТЫ
  // ============================================

  static const Color highlight = Color(0xFFE3F2FD);      // Светло-синий highlight
  static const Color highlightOrange = Color(0xFFFFE0B2); // Светло-оранжевый highlight
  static const Color highlightGreen = Color(0xFFC8E6C9);  // Светло-зеленый highlight

  // ============================================
  // ТЕНИ
  // ============================================

  static Color shadowLight = Colors.black.withValues(alpha: 0.08);
  static Color shadowMedium = Colors.black.withValues(alpha: 0.16);
  static Color shadowHeavy = Colors.black.withValues(alpha: 0.24);

  // ============================================
  // ГРАДИЕНТЫ
  // ============================================

  /// Основной градиент (Синий)
  static const LinearGradient primaryGradient = LinearGradient(
    colors: [primary, primaryLight],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  /// Акцентный градиент (Оранжевый)
  static const LinearGradient accentGradient = LinearGradient(
    colors: [accent, accentLight],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  /// Градиент успеха (Зеленый)
  static const LinearGradient successGradient = LinearGradient(
    colors: [success, successLight],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  /// Фоновый градиент для экранов
  static const LinearGradient backgroundGradient = LinearGradient(
    begin: Alignment.topCenter,
    end: Alignment.bottomCenter,
    colors: [
      Color(0xFFE3F2FD),  // Светло-синий
      Color(0xFFFAFAFA),  // Светло-серый
      Color(0xFFFFFFFF),  // Белый
    ],
  );

  /// Градиент для onboarding экранов
  static const LinearGradient onboardingGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [
      Color(0xFF1976D2),  // Синий
      Color(0xFF42A5F5),  // Светло-синий
      Color(0xFFFF9800),  // Оранжевый
    ],
  );
}
