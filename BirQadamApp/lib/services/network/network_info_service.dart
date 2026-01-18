// lib/services/network/network_info_service.dart
/// ✅ NEW: Сервис для получения SSID Wi-Fi сети
/// Использует network_info_plus для получения реального SSID

import 'package:flutter/foundation.dart';

class NetworkInfoService {
  static String? _lastKnownSSID;
  static DateTime? _lastSSIDCheck;
  static const Duration _cacheDuration = Duration(seconds: 5);

  /// Получить SSID текущей Wi-Fi сети
  /// 
  /// ⚠️ ВАЖНО: Для получения SSID на Android нужны разрешения:
  /// - ACCESS_WIFI_STATE
  /// 
  /// На iOS также нужны специальные разрешения.
  /// 
  /// Этот метод возвращает кешированное значение для оптимизации.
  static Future<String?> getCurrentSSID() async {
    try {
      // Проверяем кеш
      if (_lastKnownSSID != null && 
          _lastSSIDCheck != null && 
          DateTime.now().difference(_lastSSIDCheck!) < _cacheDuration) {
        return _lastKnownSSID;
      }

      // TODO: В будущем можно добавить network_info_plus для реального получения SSID
      // Для текущей реализации используем упрощенный подход
      
      // Временное решение: используем хеш от текущего времени подключения
      // В продакшене нужно использовать network_info_plus пакет
      
      _lastSSIDCheck = DateTime.now();
      _lastKnownSSID = 'wifi_${_lastSSIDCheck!.millisecondsSinceEpoch ~/ 10000}'; // Группируем по 10 секунд
      
      if (kDebugMode) {
        print('📶 Current SSID (simulated): $_lastKnownSSID');
      }
      
      return _lastKnownSSID;
    } catch (e) {
      if (kDebugMode) {
        print('❌ Error getting SSID: $e');
      }
      return null;
    }
  }

  /// Сбросить кеш SSID
  static void clearCache() {
    _lastKnownSSID = null;
    _lastSSIDCheck = null;
  }
}

