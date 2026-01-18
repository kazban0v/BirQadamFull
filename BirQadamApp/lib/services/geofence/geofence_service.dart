// lib/services/geofence_service.dart

import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:geolocator/geolocator.dart';
import '../../providers/geofence_provider.dart';
import '../notifications/notification_service.dart';

class GeofenceService {
  static final GeofenceService _instance = GeofenceService._internal();
  factory GeofenceService() => _instance;
  GeofenceService._internal();

  Timer? _monitoringTimer;
  bool _isMonitoring = false;
  Position? _lastPosition;

  /// Интервал проверки (в секундах)
  static const int _checkIntervalSeconds = 60; // 1 минута

  /// Минимальное расстояние для обновления (в метрах)
  static const double _minDistanceMeters = 50.0; // 50 метров

  bool get isMonitoring => _isMonitoring;

  /// Запустить мониторинг геолокации
  Future<void> startMonitoring(GeofenceProvider geofenceProvider) async {
    if (_isMonitoring) {
      debugPrint('⚠️ Geofence monitoring already running');
      return;
    }

    // Проверка разрешений
    final hasPermission = await _checkLocationPermission();
    if (!hasPermission) {
      debugPrint('❌ Location permission not granted');
      return;
    }

    _isMonitoring = true;
    debugPrint('✅ Starting geofence monitoring');

    // Немедленная проверка
    await _checkGeofences(geofenceProvider);

    // Периодическая проверка
    _monitoringTimer = Timer.periodic(
      const Duration(seconds: _checkIntervalSeconds),
      (timer) async {
        await _checkGeofences(geofenceProvider);
      },
    );
  }

  /// Остановить мониторинг
  void stopMonitoring() {
    _monitoringTimer?.cancel();
    _monitoringTimer = null;
    _isMonitoring = false;
    _lastPosition = null;
    debugPrint('🛑 Geofence monitoring stopped');
  }

  /// Проверить геозоны
  Future<void> _checkGeofences(GeofenceProvider geofenceProvider) async {
    try {
      // Получить текущую позицию
      final position = await _getCurrentPosition();
      if (position == null) return;

      // Проверить, достаточно ли пользователь переместился
      if (_lastPosition != null) {
        final distance = Geolocator.distanceBetween(
          _lastPosition!.latitude,
          _lastPosition!.longitude,
          position.latitude,
          position.longitude,
        );

        if (distance < _minDistanceMeters) {
          debugPrint('📍 User hasn\'t moved enough: ${distance.toStringAsFixed(1)}m');
          return;
        }
      }

      _lastPosition = position;

      debugPrint('📍 Checking geofences at: ${position.latitude}, ${position.longitude}');

      // Проверить позицию относительно всех напоминаний
      final triggeredReminders = await geofenceProvider.checkPosition(
        latitude: position.latitude,
        longitude: position.longitude,
      );

      // Отправить уведомления
      if (triggeredReminders.isNotEmpty) {
        for (final reminder in triggeredReminders) {
          debugPrint('🔔 Geofence triggered: ${reminder.locationName}');
          await _sendNotification(reminder);
        }
      }
    } catch (e) {
      debugPrint('❌ Error checking geofences: $e');
    }
  }

  /// Проверить разрешения на геолокацию
  Future<bool> _checkLocationPermission() async {
    bool serviceEnabled;
    LocationPermission permission;

    // Проверка, включена ли служба геолокации
    serviceEnabled = await Geolocator.isLocationServiceEnabled();
    if (!serviceEnabled) {
      debugPrint('❌ Location services are disabled');
      return false;
    }

    // Проверка разрешений
    permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
      if (permission == LocationPermission.denied) {
        debugPrint('❌ Location permissions are denied');
        return false;
      }
    }

    if (permission == LocationPermission.deniedForever) {
      debugPrint('❌ Location permissions are permanently denied');
      return false;
    }

    return true;
  }

  /// Получить текущую позицию
  Future<Position?> _getCurrentPosition() async {
    try {
      final position = await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.high,
        timeLimit: const Duration(seconds: 10),
      );
      return position;
    } catch (e) {
      debugPrint('❌ Error getting current position: $e');
      return null;
    }
  }

  /// Отправить уведомление
  Future<void> _sendNotification(dynamic reminder) async {
    try {
      final title = '📍 Вы рядом с местом события!';
      final body = 'Привет! 👋\nВы находитесь рядом с "${reminder.locationName}". '
          'Не забудьте подтвердить своё участие и приступайте к выполнению задания. '
          'Спасибо, что помогаете делать мир чище! 💚';

      await NotificationService.showLocalNotification(
        id: reminder.id,
        title: title,
        body: body,
        payload: 'geofence:${reminder.id}',
      );

      debugPrint('✅ Geofence notification sent: ${reminder.locationName}');
    } catch (e) {
      debugPrint('❌ Error sending geofence notification: $e');
    }
  }

  /// Запросить разрешение на геолокацию
  static Future<bool> requestLocationPermission() async {
    bool serviceEnabled;
    LocationPermission permission;

    // Проверка, включена ли служба геолокации
    serviceEnabled = await Geolocator.isLocationServiceEnabled();
    if (!serviceEnabled) {
      return false;
    }

    // Проверка и запрос разрешений
    permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
      if (permission == LocationPermission.denied) {
        return false;
      }
    }

    if (permission == LocationPermission.deniedForever) {
      return false;
    }

    return true;
  }

  /// Открыть настройки геолокации
  static Future<void> openLocationSettings() async {
    await Geolocator.openLocationSettings();
  }
}

