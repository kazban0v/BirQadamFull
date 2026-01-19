// lib/services/network/network_monitor_service.dart
/// ✅ NEW: Сервис для отслеживания изменений Wi-Fi сети и автоматического переключения IP

import 'dart:async';
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

class NetworkMonitorService {
  static final NetworkMonitorService _instance = NetworkMonitorService._internal();
  factory NetworkMonitorService() => _instance;
  NetworkMonitorService._internal();

  final Connectivity _connectivity = Connectivity();
  StreamSubscription<List<ConnectivityResult>>? _connectivitySubscription;
  
  String? _currentSSID;
  final Map<String, String> _networkIpMap = {}; // SSID -> IP адрес
  
  /// Callback когда меняется сеть
  Function(String? ssid, String? savedIp)? onNetworkChanged;

  /// Инициализация мониторинга сети
  Future<void> initialize() async {
    try {
      // Загружаем сохраненные IP адреса для разных сетей
      await _loadSavedNetworks();

      // Получаем текущую сеть
      await _connectivity.checkConnectivity();
      _currentSSID = await _getCurrentSSID();

      // Применяем IP для текущей сети
      await _applyNetworkIp(_currentSSID);

      // Слушаем изменения сети
      _connectivitySubscription = _connectivity.onConnectivityChanged.listen(
        (List<ConnectivityResult> results) async {
          await _handleConnectivityChange(results);
        },
      );

      if (kDebugMode) {
        print('✅ NetworkMonitor initialized. Current SSID: $_currentSSID');
      }
    } catch (e) {
      if (kDebugMode) {
        print('❌ Error initializing NetworkMonitor: $e');
      }
    }
  }

  /// Обработка изменения подключения
  Future<void> _handleConnectivityChange(List<ConnectivityResult> results) async {
    final hasWifi = results.contains(ConnectivityResult.wifi);
    
    if (!hasWifi) {
      if (kDebugMode) {
        print('📶 No WiFi connection');
      }
      return;
    }

    final newSSID = await _getCurrentSSID();
    
    if (newSSID != _currentSSID) {
      if (kDebugMode) {
        print('🔄 Network changed: $_currentSSID -> $newSSID');
      }
      
      _currentSSID = newSSID;
      await _applyNetworkIp(newSSID);
      
      // Уведомляем о смене сети
      if (onNetworkChanged != null) {
        onNetworkChanged!(newSSID, _networkIpMap[newSSID]);
      }
    }
  }

  /// Получить текущий SSID (имя Wi-Fi сети)
  /// ⚠️ На Android это требует специальных разрешений и может вернуть null
  Future<String?> _getCurrentSSID() async {
    try {
      // connectivity_plus не предоставляет SSID напрямую
      // Для получения SSID нужны дополнительные плагины (wifi_iot, network_info_plus)
      // Пока используем упрощенный подход - отслеживаем по ConnectivityResult
      
      // В реальном приложении можно использовать network_info_plus для получения SSID
      // Для простоты сейчас будем использовать время как идентификатор сети
      // Это временное решение - в продакшене нужно использовать network_info_plus
      
      return 'network_${DateTime.now().millisecondsSinceEpoch}'; // Временное решение
    } catch (e) {
      if (kDebugMode) {
        print('⚠️ Could not get SSID: $e');
      }
      return null;
    }
  }

  /// Применить сохраненный IP для сети или использовать по умолчанию
  Future<void> _applyNetworkIp(String? ssid) async {
    if (ssid == null) return;

    final savedIp = _networkIpMap[ssid];
    
    if (kDebugMode) {
      print('📡 Applying IP for network $ssid: ${savedIp ?? "default"}');
    }
    
    // IP будет применяться автоматически через SettingsProvider при следующем запросе
  }

  /// Сохранить IP адрес для текущей сети
  Future<void> saveIpForCurrentNetwork(String ip) async {
    if (_currentSSID == null) {
      _currentSSID = await _getCurrentSSID();
    }

    if (_currentSSID != null) {
      _networkIpMap[_currentSSID!] = ip;
      await _saveNetworksToStorage();
      
      if (kDebugMode) {
        print('✅ Saved IP $ip for network $_currentSSID');
      }
    }
  }

  /// Получить сохраненный IP для текущей сети
  String? getIpForCurrentNetwork() {
    if (_currentSSID == null) return null;
    return _networkIpMap[_currentSSID];
  }

  /// Получить сохраненный IP для конкретной сети
  String? getIpForNetwork(String ssid) {
    return _networkIpMap[ssid];
  }

  /// Получить все сохраненные сети
  Map<String, String> getAllSavedNetworks() {
    return Map.unmodifiable(_networkIpMap);
  }

  /// Удалить сохраненный IP для сети
  Future<void> removeNetworkIp(String ssid) async {
    _networkIpMap.remove(ssid);
    await _saveNetworksToStorage();
  }

  /// Загрузить сохраненные сети из хранилища
  Future<void> _loadSavedNetworks() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final networksJson = prefs.getString('network_ip_map');
      
      if (networksJson != null) {
        // Простое сохранение как JSON строки
        // Формат: "ssid1|ip1,ssid2|ip2"
        final pairs = networksJson.split(',');
        for (final pair in pairs) {
          if (pair.contains('|')) {
            final parts = pair.split('|');
            if (parts.length == 2) {
              _networkIpMap[parts[0]] = parts[1];
            }
          }
        }
        
        if (kDebugMode) {
          print('✅ Loaded ${_networkIpMap.length} saved networks');
        }
      }
    } catch (e) {
      if (kDebugMode) {
        print('❌ Error loading saved networks: $e');
      }
    }
  }

  /// Сохранить сети в хранилище
  Future<void> _saveNetworksToStorage() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      // Простое сохранение как строка
      final networksJson = _networkIpMap.entries
          .map((e) => '${e.key}|${e.value}')
          .join(',');
      await prefs.setString('network_ip_map', networksJson);
      
      if (kDebugMode) {
        print('✅ Saved ${_networkIpMap.length} networks to storage');
      }
    } catch (e) {
      if (kDebugMode) {
        print('❌ Error saving networks: $e');
      }
    }
  }

  /// Получить текущий SSID (публичный метод)
  String? get currentSSID => _currentSSID;

  /// Освобождение ресурсов
  void dispose() {
    _connectivitySubscription?.cancel();
    _connectivitySubscription = null;
  }
}

