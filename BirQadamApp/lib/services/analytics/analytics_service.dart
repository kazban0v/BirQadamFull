/// ✅ ИСПРАВЛЕНИЕ СредП-16: Firebase Analytics Service
import 'package:firebase_analytics/firebase_analytics.dart';
import 'package:firebase_core/firebase_core.dart';

class AnalyticsService {
  static final AnalyticsService _instance = AnalyticsService._internal();
  factory AnalyticsService() => _instance;
  AnalyticsService._internal();

  FirebaseAnalytics? _analytics;
  FirebaseAnalyticsObserver? _observer;
  bool _initialized = false;

  /// Инициализация Firebase Analytics
  Future<void> initialize() async {
    try {
      // Проверяем, что Firebase инициализирован
      if (Firebase.apps.isEmpty) {
        print('⚠️ Firebase не инициализирован, пропускаем Analytics');
        return;
      }

      _analytics = FirebaseAnalytics.instance;
      _observer = FirebaseAnalyticsObserver(analytics: _analytics!);
      _initialized = true;
      
      print('✅ Firebase Analytics инициализирован');
      
      // Отправляем событие запуска приложения
      await logAppOpen();
    } catch (e) {
      print('❌ Ошибка инициализации Analytics: $e');
      _initialized = false;
    }
  }

  /// Получить observer для Navigator
  FirebaseAnalyticsObserver? get observer => _observer;

  /// Проверка инициализации
  bool get isInitialized => _initialized;

  // ========== СОБЫТИЯ ПОЛЬЗОВАТЕЛЯ ==========

  /// Вход пользователя
  Future<void> logLogin({required String method}) async {
    if (!_initialized) return;
    try {
      await _analytics?.logLogin(loginMethod: method);
      print('📊 Analytics: Login ($method)');
    } catch (e) {
      print('❌ Analytics error: $e');
    }
  }

  /// Регистрация пользователя
  Future<void> logSignUp({required String method, required String role}) async {
    if (!_initialized) return;
    try {
      await _analytics?.logSignUp(signUpMethod: method);
      await _analytics?.logEvent(
        name: 'user_registered',
        parameters: {
          'method': method,
          'role': role,
          'timestamp': DateTime.now().toIso8601String(),
        },
      );
      print('📊 Analytics: Sign Up ($method, $role)');
    } catch (e) {
      print('❌ Analytics error: $e');
    }
  }

  /// Выход пользователя
  Future<void> logLogout() async {
    if (!_initialized) return;
    try {
      await _analytics?.logEvent(name: 'logout');
      print('📊 Analytics: Logout');
    } catch (e) {
      print('❌ Analytics error: $e');
    }
  }

  // ========== СОБЫТИЯ ПРОЕКТОВ ==========

  /// Просмотр проекта
  Future<void> logViewProject({required String projectId, required String projectName}) async {
    if (!_initialized) return;
    try {
      await _analytics?.logEvent(
        name: 'view_item',
        parameters: {
          'item_id': projectId,
          'item_name': projectName,
          'item_category': 'project',
        },
      );
      print('📊 Analytics: View Project ($projectName)');
    } catch (e) {
      print('❌ Analytics error: $e');
    }
  }

  /// Присоединение к проекту
  Future<void> logJoinProject({required String projectId, required String projectName}) async {
    if (!_initialized) return;
    try {
      await _analytics?.logEvent(
        name: 'join_project',
        parameters: {
          'project_id': projectId,
          'project_name': projectName,
          'timestamp': DateTime.now().toIso8601String(),
        },
      );
      print('📊 Analytics: Join Project ($projectName)');
    } catch (e) {
      print('❌ Analytics error: $e');
    }
  }

  /// Создание проекта (организатор)
  Future<void> logCreateProject({required String projectName, required String city}) async {
    if (!_initialized) return;
    try {
      await _analytics?.logEvent(
        name: 'create_project',
        parameters: {
          'project_name': projectName,
          'city': city,
          'timestamp': DateTime.now().toIso8601String(),
        },
      );
      print('📊 Analytics: Create Project ($projectName)');
    } catch (e) {
      print('❌ Analytics error: $e');
    }
  }

  // ========== СОБЫТИЯ ЗАДАЧ ==========

  /// Принятие задачи
  Future<void> logAcceptTask({required String taskId}) async {
    if (!_initialized) return;
    try {
      await _analytics?.logEvent(
        name: 'accept_task',
        parameters: {
          'task_id': taskId,
          'timestamp': DateTime.now().toIso8601String(),
        },
      );
      print('📊 Analytics: Accept Task ($taskId)');
    } catch (e) {
      print('❌ Analytics error: $e');
    }
  }

  /// Завершение задачи
  Future<void> logCompleteTask({required String taskId}) async {
    if (!_initialized) return;
    try {
      await _analytics?.logEvent(
        name: 'complete_task',
        parameters: {
          'task_id': taskId,
          'timestamp': DateTime.now().toIso8601String(),
        },
      );
      print('📊 Analytics: Complete Task ($taskId)');
    } catch (e) {
      print('❌ Analytics error: $e');
    }
  }

  // ========== СОБЫТИЯ ФОТО ==========

  /// Загрузка фотоотчёта
  Future<void> logUploadPhoto({required String taskId, required String projectId}) async {
    if (!_initialized) return;
    try {
      await _analytics?.logEvent(
        name: 'upload_photo',
        parameters: {
          'task_id': taskId,
          'project_id': projectId,
          'timestamp': DateTime.now().toIso8601String(),
        },
      );
      print('📊 Analytics: Upload Photo (task: $taskId)');
    } catch (e) {
      print('❌ Analytics error: $e');
    }
  }

  /// Одобрение фото (организатор)
  Future<void> logApprovePhoto({required String photoId, required int rating}) async {
    if (!_initialized) return;
    try {
      await _analytics?.logEvent(
        name: 'approve_photo',
        parameters: {
          'photo_id': photoId,
          'rating': rating,
          'timestamp': DateTime.now().toIso8601String(),
        },
      );
      print('📊 Analytics: Approve Photo (rating: $rating)');
    } catch (e) {
      print('❌ Analytics error: $e');
    }
  }

  // ========== СОБЫТИЯ ДОСТИЖЕНИЙ ==========

  /// Разблокировка достижения
  Future<void> logUnlockAchievement({required String achievementId, required String achievementName}) async {
    if (!_initialized) return;
    try {
      await _analytics?.logEvent(
        name: 'unlock_achievement',
        parameters: {
          'achievement_id': achievementId,
        },
      );
      await _analytics?.logEvent(
        name: 'achievement_unlocked',
        parameters: {
          'achievement_id': achievementId,
          'achievement_name': achievementName,
          'timestamp': DateTime.now().toIso8601String(),
        },
      );
      print('📊 Analytics: Unlock Achievement ($achievementName)');
    } catch (e) {
      print('❌ Analytics error: $e');
    }
  }

  /// Просмотр достижений
  Future<void> logViewAchievements() async {
    if (!_initialized) return;
    try {
      await _analytics?.logEvent(name: 'view_achievements');
      print('📊 Analytics: View Achievements');
    } catch (e) {
      print('❌ Analytics error: $e');
    }
  }

  // ========== СОБЫТИЯ НАВИГАЦИИ ==========

  /// Просмотр экрана
  Future<void> logScreenView({required String screenName, String? screenClass}) async {
    if (!_initialized) return;
    try {
      await _analytics?.logScreenView(
        screenName: screenName,
        screenClass: screenClass ?? screenName,
      );
      print('📊 Analytics: Screen View ($screenName)');
    } catch (e) {
      print('❌ Analytics error: $e');
    }
  }

  /// Открытие приложения
  Future<void> logAppOpen() async {
    if (!_initialized) return;
    try {
      await _analytics?.logAppOpen();
      print('📊 Analytics: App Open');
    } catch (e) {
      print('❌ Analytics error: $e');
    }
  }

  // ========== СОБЫТИЯ НАСТРОЕК ==========

  /// Изменение языка
  Future<void> logChangeLanguage({required String language}) async {
    if (!_initialized) return;
    try {
      await _analytics?.logEvent(
        name: 'change_language',
        parameters: {
          'language': language,
          'timestamp': DateTime.now().toIso8601String(),
        },
      );
      print('📊 Analytics: Change Language ($language)');
    } catch (e) {
      print('❌ Analytics error: $e');
    }
  }

  /// Изменение темы
  Future<void> logChangeTheme({required String theme}) async {
    if (!_initialized) return;
    try {
      await _analytics?.logEvent(
        name: 'change_theme',
        parameters: {
          'theme': theme,
          'timestamp': DateTime.now().toIso8601String(),
        },
      );
      print('📊 Analytics: Change Theme ($theme)');
    } catch (e) {
      print('❌ Analytics error: $e');
    }
  }

  // ========== КАСТОМНЫЕ СОБЫТИЯ ==========

  /// Универсальный метод для логирования событий
  Future<void> logCustomEvent({
    required String eventName,
    Map<String, dynamic>? parameters,
  }) async {
    if (!_initialized) return;
    try {
      // Конвертируем dynamic в Object для совместимости с Firebase
      final Map<String, Object>? convertedParams = parameters?.map(
        (key, value) => MapEntry(key, value as Object),
      );
      
      await _analytics?.logEvent(
        name: eventName,
        parameters: convertedParams,
      );
      print('📊 Analytics: $eventName ${parameters ?? ""}');
    } catch (e) {
      print('❌ Analytics error: $e');
    }
  }

  // ========== УСТАНОВКА СВОЙСТВ ПОЛЬЗОВАТЕЛЯ ==========

  /// Установить ID пользователя
  Future<void> setUserId(String userId) async {
    if (!_initialized) return;
    try {
      await _analytics?.setUserId(id: userId);
      print('📊 Analytics: Set User ID ($userId)');
    } catch (e) {
      print('❌ Analytics error: $e');
    }
  }

  /// Установить свойства пользователя
  Future<void> setUserProperties({
    String? role,
    String? city,
    int? rating,
  }) async {
    if (!_initialized) return;
    try {
      if (role != null) {
        await _analytics?.setUserProperty(name: 'user_role', value: role);
      }
      if (city != null) {
        await _analytics?.setUserProperty(name: 'user_city', value: city);
      }
      if (rating != null) {
        await _analytics?.setUserProperty(name: 'user_rating', value: rating.toString());
      }
      print('📊 Analytics: Set User Properties (role: $role, city: $city, rating: $rating)');
    } catch (e) {
      print('❌ Analytics error: $e');
    }
  }

  /// Очистить данные пользователя (при выходе)
  Future<void> clearUserData() async {
    if (!_initialized) return;
    try {
      await _analytics?.setUserId(id: null);
      print('📊 Analytics: Clear User Data');
    } catch (e) {
      print('❌ Analytics error: $e');
    }
  }
}

