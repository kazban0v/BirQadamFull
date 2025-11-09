import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:provider/provider.dart';
import '../../config/app_config.dart';
import 'dart:io' show Platform;
import 'package:flutter/foundation.dart' show kDebugMode;
import '../../screens/chat/chat_detail_screen.dart';
import '../../providers/chat_provider.dart';

// Глобальный ключ навигатора для доступа к контексту из сервиса уведомлений
final GlobalKey<NavigatorState> navigatorKey = GlobalKey<NavigatorState>();

// Инициализация Flutter Local Notifications
final FlutterLocalNotificationsPlugin flutterLocalNotificationsPlugin =
    FlutterLocalNotificationsPlugin();

class NotificationService {
  static final NotificationService _instance = NotificationService._internal();
  factory NotificationService() => _instance;
  NotificationService._internal();

  FirebaseMessaging? _firebaseMessaging;
  String? _fcmToken;
  String? _authToken;
  bool _firebaseInitialized = false;

  /// Базовая инициализация БЕЗ запроса разрешений
  /// Вызывается при запуске приложения
  Future<void> initialize() async {
    try {
      // Инициализация локальных уведомлений (для показа в шторке Android)
      const AndroidInitializationSettings initializationSettingsAndroid =
          AndroidInitializationSettings('@mipmap/ic_launcher');

      const InitializationSettings initializationSettings = InitializationSettings(
        android: initializationSettingsAndroid,
      );

      await flutterLocalNotificationsPlugin.initialize(
        initializationSettings,
        onDidReceiveNotificationResponse: (NotificationResponse response) {
          print('🔔 Нажато на локальное уведомление: ${response.payload}');
        },
      );

      print('✅ Flutter Local Notifications инициализирован');

      // Инициализация Firebase
      await Firebase.initializeApp();
      _firebaseMessaging = FirebaseMessaging.instance;
      _firebaseInitialized = true;
      print('✅ Firebase инициализирован успешно');

      // Обработчики уведомлений
      FirebaseMessaging.onMessage.listen(_handleForegroundMessage);
      FirebaseMessaging.onMessageOpenedApp.listen(_handleBackgroundMessage);
      FirebaseMessaging.onBackgroundMessage(_handleBackgroundMessageStatic);

      print('🎯 Базовая инициализация завершена (БЕЗ запроса разрешений)');
      
      // ✅ АВТОМАТИЧЕСКАЯ ГЕНЕРАЦИЯ FCM TOKEN, ЕСЛИ РАЗРЕШЕНИЕ УЖЕ ЕСТЬ
      _checkAndGenerateTokenIfPermissionGranted();
    } catch (e) {
      // ✅ ИСПРАВЛЕНИЕ СП-4: Улучшенная обработка ошибок Firebase
      print('❌ Ошибка инициализации Firebase: $e');
      print('🔔 Сервис уведомлений инициализирован (без Firebase)');
      _firebaseInitialized = false;

      // Fallback для случаев, когда Firebase недоступен
      _fcmToken = 'test_fcm_token_${DateTime.now().millisecondsSinceEpoch}';
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('fcm_token', _fcmToken!);
      print('🔑 Test FCM Token: $_fcmToken');
      
      // ✅ Показываем пользователю предупреждение (если контекст доступен)
      Future.delayed(Duration(seconds: 1), () {
        final context = navigatorKey.currentContext;
        if (context != null && context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('⚠️ Уведомления могут работать с ограничениями. Проверьте подключение к интернету.'),
              backgroundColor: Colors.orange,
              duration: Duration(seconds: 5),
              action: SnackBarAction(
                label: 'OK',
                textColor: Colors.white,
                onPressed: () {},
              ),
            ),
          );
        }
      });
    }
  }

  /// ✅ Проверка и генерация FCM token, если разрешение уже есть
  /// Вызывается автоматически при initialize()
  Future<void> _checkAndGenerateTokenIfPermissionGranted() async {
    try {
      if (!_firebaseInitialized || _firebaseMessaging == null) {
        return;
      }

      // Проверяем, есть ли уже разрешение
      final status = await Permission.notification.status;
      
      if (status.isGranted) {
        print('✅ Разрешение на уведомления уже есть, генерируем FCM token...');
        
        // Получение FCM токена
        _fcmToken = await _firebaseMessaging!.getToken();
        
        if (_fcmToken != null) {
          print('✅ FCM Token получен автоматически: ${_fcmToken!.substring(0, 20)}...');
          
          // Сохранение токена локально
          final prefs = await SharedPreferences.getInstance();
          await prefs.setString('fcm_token', _fcmToken!);
          print('💾 FCM Token сохранён локально');
          
          // Если уже авторизован, отправить токен на сервер
          if (_authToken != null) {
            print('📤 Отправляем токен на сервер...');
            await _sendTokenToServer();
          }
        }
      } else {
        print('ℹ️ Разрешение на уведомления не дано. Будет запрошено на онбординге.');
      }
    } catch (e) {
      print('❌ Ошибка проверки разрешения: $e');
    }
  }

  /// Запрос разрешения на уведомления
  /// Вызывается ТОЛЬКО на экране онбординга
  Future<bool> requestNotificationPermission() async {
    try {
      print('📱 Начинаем запрос разрешения на уведомления...');
      
      if (!_firebaseInitialized || _firebaseMessaging == null) {
        print('❌ Firebase не инициализирован. Сначала вызовите initialize()');
        return false;
      }

      // ШАГ 1: Запрос разрешения через permission_handler (для Android 13+)
      print('🔔 Запрашиваем разрешение через permission_handler...');
      final status = await Permission.notification.request();
      print('📊 Статус разрешения: $status');

      if (status.isDenied) {
        print('⚠️ Пользователь отклонил разрешение на уведомления');
        return false;
      }

      if (status.isPermanentlyDenied) {
        print('❌ Разрешение отклонено навсегда. Предложить открыть настройки');
        await openAppSettings();
        return false;
      }

      // ШАГ 2: Запрос разрешения через Firebase (для iOS и дополнительных настроек)
      print('🔔 Запрашиваем разрешение через Firebase...');
      NotificationSettings settings = await _firebaseMessaging!.requestPermission(
        alert: true,
        badge: true,
        sound: true,
      );

      print('🔔 Firebase разрешение: ${settings.authorizationStatus}');

      if (settings.authorizationStatus == AuthorizationStatus.authorized ||
          settings.authorizationStatus == AuthorizationStatus.provisional ||
          status.isGranted) {
        // Получение FCM токена
        print('🔑 Получаем FCM Token...');
        _fcmToken = await _firebaseMessaging!.getToken();
        print('✅ FCM Token получен: ${_fcmToken?.substring(0, 20)}...');

        // Сохранение токена локально
        if (_fcmToken != null) {
          final prefs = await SharedPreferences.getInstance();
          await prefs.setString('fcm_token', _fcmToken!);
          print('💾 FCM Token сохранён локально');
          
          // Если уже авторизован, отправить токен на сервер
          if (_authToken != null) {
            print('📤 Отправляем токен на сервер...');
            await _sendTokenToServer();
          }
        }

        print('✅✅✅ Разрешение на уведомления получено успешно!');
        return true;
      } else {
        print('⚠️ Пользователь отклонил разрешение на уведомления');
        return false;
      }
    } catch (e) {
      print('❌ Ошибка запроса разрешения: $e');
      print('📋 Stack trace: ${StackTrace.current}');
      return false;
    }
  }

  Future<void> setAuthToken(String token) async {
    _authToken = token;

    if (kDebugMode) {
      print('=' * 80);
      print('🔐 Setting auth token for FCM');
      print('   Auth token: ${token.substring(0, 20)}...');
      print('   FCM token: $_fcmToken');
      print('   Firebase initialized: $_firebaseInitialized');
      print('=' * 80);
    }

    // Отправка FCM токена на сервер при авторизации
    if (_fcmToken != null && _authToken != null) {
      print('📤 Sending FCM token to server...');
      await _sendTokenToServer();
    } else {
      print('❌ Cannot send FCM token:');
      print('   FCM token is null: ${_fcmToken == null}');
      print('   Auth token is null: ${_authToken == null}');
    }
  }

  void _handleForegroundMessage(RemoteMessage message) {
    print('📱 Получено уведомление в foreground: ${message.notification?.title}');

    // Показать уведомление в приложении
    if (message.notification != null) {
      print('📢 Уведомление: ${message.notification!.title} - ${message.notification!.body}');

      // ✅ ИСПРАВЛЕНИЕ: Убрано дублирование!
      // Локальное уведомление показывает НАТИВНЫЙ код (MyFirebaseMessagingService.kt для Android, AppDelegate.swift для iOS)
      // Поэтому здесь НЕ вызываем _showLocalNotification()
      
      // Показываем ТОЛЬКО in-app уведомление (внутри приложения)
      final context = navigatorKey.currentContext;
      if (context != null) {
        showInAppNotification(
          context,
          message.notification!.title ?? 'Уведомление',
          message.notification!.body ?? ''
        );
      }
    }

    // Обработка данных уведомления
    _handleNotificationData(message.data);
  }

  void _handleBackgroundMessage(RemoteMessage message) {
    print('📱 Открыто уведомление из background: ${message.notification?.title}');
    _handleNotificationData(message.data);
  }

  static Future<void> _handleBackgroundMessageStatic(RemoteMessage message) async {
    print('📱 Получено уведомление в background: ${message.notification?.title}');
    // Для статического метода мы не можем вызвать _handleNotificationData напрямую
    // Данные будут обработаны при следующем запуске приложения
  }

  void _handleNotificationData(Map<String, dynamic> data) {
    print('📊 Данные уведомления: $data');

    // Обработка различных типов уведомлений
    final notificationType = data['type'];
    final context = navigatorKey.currentContext;

    if (context != null && notificationType != null) {
      switch (notificationType) {
        case 'task_assigned':
          _handleTaskAssigned(context, data);
          break;
        case 'project_approved':
          _handleProjectApproved(context, data);
          break;
        case 'project_deleted':
          _handleProjectDeleted(context, data);
          break;
        case 'photo_rejected':
          _handlePhotoRejected(context, data);
          break;
        case 'chat_message':
          _handleChatMessage(context, data);
          break;
        default:
          print('⚠️ Неизвестный тип уведомления: $notificationType');
      }
    }
  }

  void _handleTaskAssigned(BuildContext context, Map<String, dynamic> data) {
    final projectTitle = data['project_title'] ?? 'Проект';
    final taskText = data['task_text'] ?? 'Новое задание';

    showInAppNotification(
      context,
      'Новое задание!',
      'Проект: $projectTitle\nЗадание: $taskText'
    );
  }

  void _handleProjectApproved(BuildContext context, Map<String, dynamic> data) {
    final projectTitle = data['project_title'] ?? 'Проект';

    showInAppNotification(
      context,
      'Проект одобрен!',
      'Ваш проект "$projectTitle" был одобрен администратором.'
    );
  }

  void _handleProjectDeleted(BuildContext context, Map<String, dynamic> data) {
    final projectTitle = data['project_title'] ?? 'Проект';

    showInAppNotification(
      context,
      'Проект удален',
      'Проект "$projectTitle" был удален организатором.'
    );
  }

  void _handlePhotoRejected(BuildContext context, Map<String, dynamic> data) {
    final projectTitle = data['project_title'] ?? 'Проект';

    showInAppNotification(
      context,
      'Фото отклонено',
      'Ваше фото для проекта "$projectTitle" было отклонено.'
    );
  }

  void _handleChatMessage(BuildContext context, Map<String, dynamic> data) {
    // Получаем данные из уведомления
    final chatId = int.tryParse(data['chat_id']?.toString() ?? '');
    final messageText = data['body'] ?? 'Новое сообщение';
    final senderName = data['title']?.toString().split(' в ')[0] ?? 'Пользователь';

    if (chatId != null) {
      // ⚡ МГНОВЕННО обновляем список чатов
      try {
        // Используем Provider для обновления списка чатов
        final chatProvider = context.read<ChatProvider>();
        chatProvider.loadChats();
        print('💬 Список чатов обновлен после получения push-уведомления');
      } catch (e) {
        print('❌ Ошибка обновления чатов: $e');
      }
      
      // Показываем in-app уведомление с возможностью открыть чат
      showInAppNotification(
        context,
        'Новое сообщение 💬',
        '$senderName: $messageText',
        onTap: () {
          // Открываем экран чата
          Navigator.of(context).push(
            MaterialPageRoute(
              builder: (context) => ChatDetailScreen(chatId: chatId),
            ),
          );
        },
      );
    }
  }

  Future<void> _sendTokenToServer() async {
    if (_fcmToken == null || _authToken == null) return;

    try {
      final url = AppConfig.deviceTokenUrl;
      if (kDebugMode) {
        print('📤 Sending FCM token to: $url');
        print('   Token: ${_fcmToken!.substring(0, 50)}...');
        print('   Auth: Bearer ${_authToken!.substring(0, 20)}...');
      }

      final response = await http.post(
        Uri.parse(url),
        headers: {
          'Authorization': 'Bearer $_authToken',
          'Content-Type': 'application/json',
        },
        body: jsonEncode({
          'token': _fcmToken,
          'platform': Platform.isIOS ? 'ios' : 'android',  // ✅ Автоопределение платформы
        }),
      );

      if (kDebugMode) {
        print('📡 Response status: ${response.statusCode}');
        print('📄 Response body: ${response.body}');
      }

      if (response.statusCode == 200 || response.statusCode == 201) {
        print('✅ FCM токен успешно отправлен на сервер');
      } else {
        print('❌ Ошибка отправки FCM токена: ${response.statusCode}');
        print('   ${response.body}');
      }
    } catch (e) {
      print('❌ Ошибка подключения при отправке токена: $e');
    }
  }

  Future<void> removeTokenFromServer() async {
    if (_authToken == null) return;

    try {
      // ✅ Используем AppConfig вместо hardcoded URL
      final response = await http.delete(
        Uri.parse(AppConfig.deviceTokenUrl),
        headers: {
          'Authorization': 'Bearer $_authToken',
          'Content-Type': 'application/json',
        },
      );

      if (response.statusCode == 200) {
        print('✅ FCM токен удален с сервера');
      }
    } catch (e) {
      print('❌ Ошибка удаления токена: $e');
    }
  }

  String? get fcmToken => _fcmToken;

  /// Статический метод для показа локальных уведомлений (для геолокации и т.д.)
  static Future<void> showLocalNotification({
    required int id,
    required String title,
    required String body,
    String? payload,
  }) async {
    const AndroidNotificationDetails androidPlatformChannelSpecifics =
        AndroidNotificationDetails(
      'geofence_channel',
      'Геолокационные напоминания',
      channelDescription: 'Уведомления при приближении к месту проекта',
      importance: Importance.high,
      priority: Priority.high,
      showWhen: true,
      icon: '@mipmap/ic_launcher',
    );

    const NotificationDetails platformChannelSpecifics =
        NotificationDetails(android: androidPlatformChannelSpecifics);

    await flutterLocalNotificationsPlugin.show(
      id,
      title,
      body,
      platformChannelSpecifics,
      payload: payload,
    );
  }
}

// Глобальная функция для показа уведомлений в приложении
void showInAppNotification(
  BuildContext context,
  String title,
  String body, {
  VoidCallback? onTap,
}) {
  ScaffoldMessenger.of(context).showSnackBar(
    SnackBar(
      content: InkWell(
        onTap: onTap != null
            ? () {
                ScaffoldMessenger.of(context).hideCurrentSnackBar();
                onTap();
              }
            : null,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              title,
              style: const TextStyle(
                fontWeight: FontWeight.bold,
                color: Colors.white,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              body,
              style: const TextStyle(color: Colors.white),
            ),
            if (onTap != null) ...[
              const SizedBox(height: 8),
              const Text(
                'Нажмите, чтобы открыть',
                style: TextStyle(
                  color: Colors.white70,
                  fontSize: 12,
                  fontStyle: FontStyle.italic,
                ),
              ),
            ],
          ],
        ),
      ),
      backgroundColor: const Color(0xFF4CAF50),
      duration: const Duration(seconds: 5),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(10),
      ),
    ),
  );
}