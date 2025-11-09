/// Централизованная конфигурация приложения
import 'package:shared_preferences/shared_preferences.dart';

class AppConfig {
  // 🔧 Режим работы (production/development)
  static const bool isProduction = bool.fromEnvironment(
    'PRODUCTION',
    defaultValue: false,
  );

  // ✅ NEW: Функция для получения API URL с учетом настроек пользователя
  static String getApiBaseUrl({String? customUrlFromSettings}) {
    // 1. Приоритет: пользовательский URL из настроек (самый высокий приоритет)
    if (customUrlFromSettings != null && customUrlFromSettings.isNotEmpty) {
      return customUrlFromSettings;
    }

    // 2. Приоритет: URL через dart-define
    const customUrl = String.fromEnvironment('API_URL');
    if (customUrl.isNotEmpty) {
      return customUrl;
    }
    
    // 3. По умолчанию: выбираем по режиму
    if (isProduction) {
      // ✅ Production: HTTPS
      return 'https://api.birqadam.kz';
    } else {
      // 🔧 Development: HTTP для эмулятора
      return 'http://10.0.2.2:8000';  // Android Emulator
      // Для iOS симулятора: 'http://localhost:8000'
      // Для реального устройства: 'http://192.168.1.XXX:8000'
    }
  }

  // ✅ NEW: Асинхронная функция для получения API URL с учетом сохраненных настроек
  static Future<String> getApiBaseUrlAsync() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final savedUrl = prefs.getString('api_url');
      if (savedUrl != null && savedUrl.isNotEmpty) {
        return savedUrl;
      }
    } catch (e) {
      // Игнорируем ошибки чтения настроек
    }
    // Если нет сохраненного URL, используем стандартную логику
    return getApiBaseUrl();
  }

  // ✅ NEW: Получить API URL с учетом настроек пользователя и текущей сети
  // Используется через SettingsProvider.getEffectiveApiUrl()
  static Future<String> getApiBaseUrlWithNetwork(String? effectiveUrl) async {
    // 1. Приоритет: эффективный URL из SettingsProvider (учитывает сеть)
    if (effectiveUrl != null && effectiveUrl.isNotEmpty) {
      return effectiveUrl;
    }

    // 2. Fallback: стандартная логика
    return getApiBaseUrlAsync();
  }

  // 🌐 BASE URL для API (обратная совместимость)
  /// ✅ ИСПРАВЛЕНИЕ: Автоматическое определение URL по режиму
  /// ⚠️ ВНИМАНИЕ: Это синхронный геттер, который не учитывает сохраненные настройки пользователя
  /// Для учета настроек используйте getApiBaseUrl() с параметром или getApiBaseUrlAsync()
  static String get apiBaseUrl {
    // Если передан явный URL через dart-define, используем его
    const customUrl = String.fromEnvironment('API_URL');
    if (customUrl.isNotEmpty) {
      return customUrl;
    }
    
    // Иначе выбираем по режиму
    if (isProduction) {
      // ✅ Production: HTTPS
      return 'https://api.birqadam.kz';
    } else {
      // 🔧 Development: HTTP для эмулятора
      return 'http://10.0.2.2:8000';  // Android Emulator
      // Для iOS симулятора: 'http://localhost:8000'
      // Для реального устройства: 'http://192.168.1.XXX:8000'
    }
  }

  // 📱 Использование:
  // Development (эмулятор): flutter run
  // Development (реальное устройство): flutter run --dart-define=API_URL=http://192.168.1.100:8000
  // Production: flutter build apk --dart-define=PRODUCTION=true

  /// Полный URL для API endpoints
  static String get apiUrl => apiBaseUrl;

  // ✅ ИСПРАВЛЕНИЕ СП-2: Версионирование API
  /// API Version
  static const String apiVersion = 'v1';

  /// URL для custom admin API (с версионированием)
  static String get customAdminApiUrl => '$apiBaseUrl/custom-admin/api/$apiVersion';

  /// URL для FCM device token
  static String get deviceTokenUrl => '$customAdminApiUrl/device-token/';

  /// URL для регистрации
  static String get registerUrl => '$customAdminApiUrl/register/';

  /// URL для входа
  static String get loginUrl => '$customAdminApiUrl/login/';

  /// URL для профиля
  static String get profileUrl => '$customAdminApiUrl/profile/';

  /// URL для проектов
  static String get projectsUrl => '$customAdminApiUrl/projects/';

  /// URL для задач
  static String get tasksUrl => '$customAdminApiUrl/tasks/';

  /// URL для фото
  static String get photosUrl => '$customAdminApiUrl/photos/';

  /// URL для достижений
  static String get achievementsUrl => '$customAdminApiUrl/achievements/';

  /// URL для активностей
  static String get activitiesUrl => '$customAdminApiUrl/activities/';

  /// URL для лидерборда
  static String get leaderboardUrl => '$customAdminApiUrl/leaderboard/';

  // 🔧 Настройки приложения
  static const bool enableLogging = !isProduction;

  // ⏱️ Таймауты (уменьшены для более быстрой обратной связи)
  static const Duration apiTimeout = Duration(seconds: 10); // ✅ Уменьшено с 30 до 10
  static const Duration connectionTimeout = Duration(seconds: 5); // ✅ Уменьшено с 15 до 5

  // 📄 Пагинация
  static const int defaultPageSize = 20;
  static const int maxPageSize = 100;

  // 📸 Медиа
  static const int maxPhotoSizeBytes = 5 * 1024 * 1024; // 5 MB
  static const List<String> allowedImageExtensions = ['jpg', 'jpeg', 'png', 'webp'];

  // 🔐 Токены
  static const Duration tokenRefreshThreshold = Duration(minutes: 5);
}
