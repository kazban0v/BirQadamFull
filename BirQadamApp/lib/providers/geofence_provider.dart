// lib/providers/geofence_provider.dart

import 'package:flutter/foundation.dart';
import 'dart:convert';
import 'dart:math';
import '../models/geofence_reminder.dart';
import '../providers/auth_provider.dart';
import '../services/api/auth_http_client.dart';
import '../config/app_config.dart';

class GeofenceProvider with ChangeNotifier {
  final AuthProvider _authProvider;
  late final AuthHttpClient _httpClient;

  List<GeofenceReminder> _reminders = [];
  bool _isLoading = false;
  String? _error;

  GeofenceProvider(this._authProvider) {
    _httpClient = AuthHttpClient(_authProvider);
  }

  List<GeofenceReminder> get reminders => _reminders;
  bool get isLoading => _isLoading;
  String? get error => _error;

  List<GeofenceReminder> get activeReminders =>
      _reminders.where((r) => r.isActive && !r.isTriggered).toList();

  /// Получить все напоминания
  Future<void> fetchReminders({
    bool? isActive,
    int? projectId,
    int? eventId,
  }) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final queryParams = <String, String>{};
      if (isActive != null) queryParams['is_active'] = isActive.toString();
      if (projectId != null) queryParams['project_id'] = projectId.toString();
      if (eventId != null) queryParams['event_id'] = eventId.toString();

      final uri = Uri.parse('${AppConfig.customAdminApiUrl}/geofence/reminders/')
          .replace(queryParameters: queryParams);

      final response = await _httpClient.get(uri);

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        if (data['success']) {
          _reminders = (data['reminders'] as List)
              .map((json) => GeofenceReminder.fromJson(json))
              .toList();
        } else {
          _error = data['error'] ?? 'Unknown error';
        }
      } else {
        _error = 'Failed to fetch reminders: ${response.statusCode}';
      }
    } catch (e) {
      _error = 'Error: $e';
      debugPrint('Error fetching geofence reminders: $e');
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  /// Создать новое напоминание
  Future<bool> createReminder({
    required double latitude,
    required double longitude,
    int radius = 500,
    String? title,
    String? message,
    int? projectId,
    int? eventId,
  }) async {
    try {
      final uri = Uri.parse('${AppConfig.customAdminApiUrl}/geofence/reminders/');

      final body = <String, dynamic>{
        'latitude': latitude,
        'longitude': longitude,
        'radius': radius,
        if (title != null) 'title': title,
        if (message != null) 'message': message,
        if (projectId != null) 'project_id': projectId,
        if (eventId != null) 'event_id': eventId,
      };

      final response = await _httpClient.post(
        uri,
        body: jsonEncode(body),
      );

      if (response.statusCode == 201) {
        final data = jsonDecode(response.body);
        if (data['success']) {
          final newReminder = GeofenceReminder.fromJson(data['reminder']);
          _reminders.insert(0, newReminder);
          notifyListeners();
          return true;
        }
      }
      return false;
    } catch (e) {
      debugPrint('Error creating geofence reminder: $e');
      return false;
    }
  }

  /// Обновить напоминание
  Future<bool> updateReminder({
    required int reminderId,
    String? title,
    String? message,
    double? latitude,
    double? longitude,
    int? radius,
    bool? isActive,
  }) async {
    try {
      final uri = Uri.parse(
          '${AppConfig.customAdminApiUrl}/geofence/reminders/$reminderId/');

      final body = <String, dynamic>{};
      if (title != null) body['title'] = title;
      if (message != null) body['message'] = message;
      if (latitude != null) body['latitude'] = latitude;
      if (longitude != null) body['longitude'] = longitude;
      if (radius != null) body['radius'] = radius;
      if (isActive != null) body['is_active'] = isActive;

      final response = await _httpClient.put(uri, body: jsonEncode(body));

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        if (data['success']) {
          // Обновить в списке
          final index = _reminders.indexWhere((r) => r.id == reminderId);
          if (index != -1) {
            await fetchReminders(); // Перезагрузить все напоминания
          }
          notifyListeners();
          return true;
        }
      }
      return false;
    } catch (e) {
      debugPrint('Error updating geofence reminder: $e');
      return false;
    }
  }

  /// Удалить напоминание
  Future<bool> deleteReminder(int reminderId) async {
    try {
      final uri = Uri.parse(
          '${AppConfig.customAdminApiUrl}/geofence/reminders/$reminderId/');

      final response = await _httpClient.delete(uri);

      if (response.statusCode == 200) {
        _reminders.removeWhere((r) => r.id == reminderId);
        notifyListeners();
        return true;
      }
      return false;
    } catch (e) {
      debugPrint('Error deleting geofence reminder: $e');
      return false;
    }
  }

  /// Проверить текущую позицию относительно всех напоминаний
  Future<List<GeofenceReminder>> checkPosition({
    required double latitude,
    required double longitude,
  }) async {
    try {
      final uri = Uri.parse('${AppConfig.customAdminApiUrl}/geofence/check/');

      final body = <String, dynamic>{
        'latitude': latitude,
        'longitude': longitude,
      };

      final response = await _httpClient.post(
        uri,
        body: jsonEncode(body),
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        debugPrint('✅ Check response: ${response.body}');
        
        if (data['success'] && data['triggered']) {
          final remindersData = data['reminders'] as List;
          debugPrint('🔔 Parsing ${remindersData.length} triggered reminders');
          
          final triggeredReminders = remindersData
              .map((json) {
                try {
                  return GeofenceReminder.fromJson(json);
                } catch (e) {
                  debugPrint('❌ Error parsing reminder: $e');
                  debugPrint('   JSON: $json');
                  return null;
                }
              })
              .whereType<GeofenceReminder>()
              .toList();

          // Обновить локальный список
          await fetchReminders();

          return triggeredReminders;
        }
      }
      return [];
    } catch (e) {
      debugPrint('Error checking geofence position: $e');
      return [];
    }
  }

  /// Получить проекты с координатами
  Future<List<Map<String, dynamic>>> getProjectsWithCoordinates() async {
    try {
      final uri = Uri.parse('${AppConfig.customAdminApiUrl}/geofence/projects/');

      final response = await _httpClient.get(uri);

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        if (data['success']) {
          return List<Map<String, dynamic>>.from(data['projects']);
        }
      }
      return [];
    } catch (e) {
      debugPrint('Error fetching projects with coordinates: $e');
      return [];
    }
  }

  /// Получить события с локацией
  Future<List<Map<String, dynamic>>> getEventsWithLocation() async {
    try {
      final uri = Uri.parse('${AppConfig.customAdminApiUrl}/geofence/events/');

      final response = await _httpClient.get(uri);

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        if (data['success']) {
          return List<Map<String, dynamic>>.from(data['events']);
        }
      }
      return [];
    } catch (e) {
      debugPrint('Error fetching events with location: $e');
      return [];
    }
  }

  /// Вычислить расстояние между двумя точками (в метрах)
  static double calculateDistance(
    double lat1,
    double lon1,
    double lat2,
    double lon2,
  ) {
    const R = 6371000; // Радиус Земли в метрах
    final phi1 = lat1 * (pi / 180);
    final phi2 = lat2 * (pi / 180);
    final deltaPhi = (lat2 - lat1) * (pi / 180);
    final deltaLambda = (lon2 - lon1) * (pi / 180);

    final a = sin(deltaPhi / 2) * sin(deltaPhi / 2) +
        cos(phi1) * cos(phi2) * sin(deltaLambda / 2) * sin(deltaLambda / 2);

    final c = 2 * atan2(sqrt(a), sqrt(1 - a));

    return R * c;
  }
}

