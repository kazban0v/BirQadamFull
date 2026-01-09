// lib/providers/settings_provider.dart
/// Provider для управления настройками приложения

import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../services/network/network_monitor_service.dart'; // ✅ NEW

class SettingsProvider with ChangeNotifier {
  static const String _keyNotificationsEnabled = 'notifications_enabled';
  static const String _keyApiUrl = 'api_url'; // ✅ Сохранение IP адреса (глобального)
  static const String _keyAutoNetworkSwitch = 'auto_network_switch'; // ✅ NEW: Автопереключение по сети

  bool _notificationsEnabled = true;
  String? _customApiUrl; // ✅ Пользовательский API URL (глобальный)
  bool _autoNetworkSwitch = true; // ✅ NEW: Автоматическое переключение IP по сети

  final NetworkMonitorService _networkMonitor = NetworkMonitorService(); // ✅ NEW

  bool get notificationsEnabled => _notificationsEnabled;
  String? get customApiUrl => _customApiUrl; // ✅ Геттер для кастомного URL
  bool get autoNetworkSwitch => _autoNetworkSwitch; // ✅ NEW

  SettingsProvider() {
    _loadSettings();
    _setupNetworkMonitoring(); // ✅ NEW
  }

  /// ✅ NEW: Настройка мониторинга сети
  void _setupNetworkMonitoring() {
    _networkMonitor.onNetworkChanged = (ssid, savedIp) async {
      if (_autoNetworkSwitch && ssid != null) {
        // Автоматически применяем IP для новой сети
        final networkIp = savedIp ?? _customApiUrl;
        if (networkIp != null && networkIp.isNotEmpty) {
          _customApiUrl = networkIp;
          await _saveApiUrlToStorage(_customApiUrl);
          notifyListeners();
          
          if (kDebugMode) {
            print('🔄 Auto-switched to IP $networkIp for network $ssid');
          }
        }
      }
    };
  }

  /// ✅ NEW: Получить актуальный IP адрес с учетом сети
  String? getEffectiveApiUrl() {
    if (!_autoNetworkSwitch) {
      // Если автопереключение выключено, используем глобальный IP
      return _customApiUrl;
    }

    // Проверяем есть ли IP для текущей сети
    final networkIp = _networkMonitor.getIpForCurrentNetwork();
    if (networkIp != null && networkIp.isNotEmpty) {
      return networkIp;
    }

    // Иначе используем глобальный IP
    return _customApiUrl;
  }

  /// Загрузить настройки из локального хранилища
  Future<void> _loadSettings() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      _notificationsEnabled = prefs.getBool(_keyNotificationsEnabled) ?? true;
      _customApiUrl = prefs.getString(_keyApiUrl); // ✅ Загрузка сохраненного IP
      _autoNetworkSwitch = prefs.getBool(_keyAutoNetworkSwitch) ?? true; // ✅ NEW: По умолчанию включено
      notifyListeners();
    } catch (e) {
      debugPrint('❌ Error loading settings: $e');
    }
  }

  /// Включить/выключить уведомления
  Future<void> setNotificationsEnabled(bool enabled) async {
    try {
      _notificationsEnabled = enabled;
      notifyListeners();

      final prefs = await SharedPreferences.getInstance();
      await prefs.setBool(_keyNotificationsEnabled, enabled);

      debugPrint('✅ Notifications ${enabled ? 'enabled' : 'disabled'}');
    } catch (e) {
      debugPrint('❌ Error saving notification setting: $e');
    }
  }

  /// ✅ Сохранить кастомный API URL (IP адрес)
  /// Если autoNetworkSwitch включен, также сохраняет для текущей сети
  Future<void> setCustomApiUrl(String? url) async {
    try {
      _customApiUrl = url?.isEmpty == true ? null : url;
      notifyListeners();

      await _saveApiUrlToStorage(_customApiUrl);

      // ✅ NEW: Если автопереключение включено, также сохраняем для текущей сети
      if (_autoNetworkSwitch && _customApiUrl != null && _customApiUrl!.isNotEmpty) {
        await _networkMonitor.saveIpForCurrentNetwork(_customApiUrl!);
      }

      debugPrint('✅ Custom API URL saved: $_customApiUrl');
    } catch (e) {
      debugPrint('❌ Error saving API URL: $e');
    }
  }

  /// ✅ NEW: Вспомогательный метод для сохранения в хранилище
  Future<void> _saveApiUrlToStorage(String? url) async {
    final prefs = await SharedPreferences.getInstance();
    if (url == null || url.isEmpty) {
      await prefs.remove(_keyApiUrl);
      debugPrint('✅ Custom API URL cleared');
    } else {
      await prefs.setString(_keyApiUrl, url);
    }
  }

  /// ✅ NEW: Включить/выключить автоматическое переключение по сети
  Future<void> setAutoNetworkSwitch(bool enabled) async {
    try {
      _autoNetworkSwitch = enabled;
      notifyListeners();

      final prefs = await SharedPreferences.getInstance();
      await prefs.setBool(_keyAutoNetworkSwitch, enabled);

      debugPrint('✅ Auto network switch ${enabled ? 'enabled' : 'disabled'}');
    } catch (e) {
      debugPrint('❌ Error saving auto network switch setting: $e');
    }
  }

  /// ✅ NEW: Получить IP для текущей сети (если есть)
  String? getCurrentNetworkIp() {
    return _networkMonitor.getIpForCurrentNetwork();
  }

  /// ✅ NEW: Получить все сохраненные сети
  Map<String, String> getAllSavedNetworks() {
    return _networkMonitor.getAllSavedNetworks();
  }

  /// ✅ NEW: Сбросить кастомный API URL (вернуться к значениям по умолчанию)
  Future<void> resetApiUrl() async {
    await setCustomApiUrl(null);
  }

  /// Сбросить настройки
  Future<void> resetSettings() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.clear();

      _notificationsEnabled = true;
      _customApiUrl = null;
      notifyListeners();

      debugPrint('✅ Settings reset');
    } catch (e) {
      debugPrint('❌ Error resetting settings: $e');
    }
  }
}




