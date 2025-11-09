/// ✅ ИСПРАВЛЕНИЕ НП-7: Provider для управления темной темой
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'dart:async';

class ThemeProvider extends ChangeNotifier {
  ThemeMode _themeMode = ThemeMode.light;
  bool _useSystemTheme = false;
  bool _autoSwitchEnabled = false;
  TimeOfDay _darkModeStartTime = const TimeOfDay(hour: 20, minute: 0); // 20:00
  TimeOfDay _lightModeStartTime = const TimeOfDay(hour: 7, minute: 0); // 07:00
  Timer? _autoSwitchTimer;

  static const String _themeModeKey = 'theme_mode';
  static const String _useSystemThemeKey = 'use_system_theme';
  static const String _autoSwitchKey = 'auto_switch_enabled';
  static const String _darkStartHourKey = 'dark_start_hour';
  static const String _darkStartMinuteKey = 'dark_start_minute';
  static const String _lightStartHourKey = 'light_start_hour';
  static const String _lightStartMinuteKey = 'light_start_minute';

  ThemeMode get themeMode => _themeMode;
  bool get isDarkMode => _themeMode == ThemeMode.dark;
  bool get isSystemTheme => _useSystemTheme;
  bool get autoSwitchEnabled => _autoSwitchEnabled;
  TimeOfDay get darkModeStartTime => _darkModeStartTime;
  TimeOfDay get lightModeStartTime => _lightModeStartTime;

  ThemeProvider() {
    _loadThemeMode();
    _startAutoSwitchTimer();
  }

  @override
  void dispose() {
    _autoSwitchTimer?.cancel();
    super.dispose();
  }

  /// Загрузка сохраненной темы
  Future<void> _loadThemeMode() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      
      // Загрузка настроек
      _useSystemTheme = prefs.getBool(_useSystemThemeKey) ?? false;
      _autoSwitchEnabled = prefs.getBool(_autoSwitchKey) ?? false;
      
      // Загрузка времени переключения
      final darkHour = prefs.getInt(_darkStartHourKey) ?? 20;
      final darkMinute = prefs.getInt(_darkStartMinuteKey) ?? 0;
      final lightHour = prefs.getInt(_lightStartHourKey) ?? 7;
      final lightMinute = prefs.getInt(_lightStartMinuteKey) ?? 0;
      
      _darkModeStartTime = TimeOfDay(hour: darkHour, minute: darkMinute);
      _lightModeStartTime = TimeOfDay(hour: lightHour, minute: lightMinute);
      
      // Загрузка темы
      if (_useSystemTheme) {
        _themeMode = ThemeMode.system;
      } else if (_autoSwitchEnabled) {
        _updateThemeBasedOnTime();
      } else {
        final savedTheme = prefs.getString(_themeModeKey);
        if (savedTheme != null) {
          _themeMode = ThemeMode.values.firstWhere(
            (mode) => mode.toString() == savedTheme,
            orElse: () => ThemeMode.light,
          );
        }
      }
      
      notifyListeners();
    } catch (e) {
      print('❌ Ошибка загрузки темы: $e');
    }
  }

  /// Переключение темы
  Future<void> toggleTheme() async {
    _themeMode = _themeMode == ThemeMode.light ? ThemeMode.dark : ThemeMode.light;
    await _saveThemeMode();
    notifyListeners();
  }

  /// Установка конкретной темы
  Future<void> setThemeMode(ThemeMode mode) async {
    if (_themeMode == mode) return;
    
    _themeMode = mode;
    await _saveThemeMode();
    notifyListeners();
  }

  /// Сохранение темы
  Future<void> _saveThemeMode() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_themeModeKey, _themeMode.toString());
      await prefs.setBool(_useSystemThemeKey, _useSystemTheme);
      await prefs.setBool(_autoSwitchKey, _autoSwitchEnabled);
    } catch (e) {
      print('❌ Ошибка сохранения темы: $e');
    }
  }

  /// ✅ THEME-2: Включить/выключить системную тему
  Future<void> setUseSystemTheme(bool value) async {
    _useSystemTheme = value;
    
    if (value) {
      _themeMode = ThemeMode.system;
      _autoSwitchEnabled = false; // Отключаем авто-переключение
    } else {
      _themeMode = ThemeMode.light; // По умолчанию светлая
    }
    
    await _saveThemeMode();
    notifyListeners();
  }

  /// ✅ THEME-3: Включить/выключить автоматическое переключение
  Future<void> setAutoSwitch(bool value) async {
    _autoSwitchEnabled = value;
    
    if (value) {
      _useSystemTheme = false; // Отключаем системную тему
      _updateThemeBasedOnTime();
      _startAutoSwitchTimer();
    } else {
      _autoSwitchTimer?.cancel();
    }
    
    await _saveThemeMode();
    notifyListeners();
  }

  /// Установить время начала темной темы
  Future<void> setDarkModeStartTime(TimeOfDay time) async {
    _darkModeStartTime = time;
    
    final prefs = await SharedPreferences.getInstance();
    await prefs.setInt(_darkStartHourKey, time.hour);
    await prefs.setInt(_darkStartMinuteKey, time.minute);
    
    if (_autoSwitchEnabled) {
      _updateThemeBasedOnTime();
    }
    
    notifyListeners();
  }

  /// Установить время начала светлой темы
  Future<void> setLightModeStartTime(TimeOfDay time) async {
    _lightModeStartTime = time;
    
    final prefs = await SharedPreferences.getInstance();
    await prefs.setInt(_lightStartHourKey, time.hour);
    await prefs.setInt(_lightStartMinuteKey, time.minute);
    
    if (_autoSwitchEnabled) {
      _updateThemeBasedOnTime();
    }
    
    notifyListeners();
  }

  /// Обновить тему на основе текущего времени
  void _updateThemeBasedOnTime() {
    final now = TimeOfDay.now();
    final nowMinutes = now.hour * 60 + now.minute;
    final darkStartMinutes = _darkModeStartTime.hour * 60 + _darkModeStartTime.minute;
    final lightStartMinutes = _lightModeStartTime.hour * 60 + _lightModeStartTime.minute;

    // Если темная тема начинается позже светлой (например, 20:00 - 07:00)
    if (darkStartMinutes > lightStartMinutes) {
      if (nowMinutes >= darkStartMinutes || nowMinutes < lightStartMinutes) {
        _themeMode = ThemeMode.dark;
      } else {
        _themeMode = ThemeMode.light;
      }
    } else {
      // Если светлая тема начинается позже темной (необычный случай)
      if (nowMinutes >= lightStartMinutes && nowMinutes < darkStartMinutes) {
        _themeMode = ThemeMode.light;
      } else {
        _themeMode = ThemeMode.dark;
      }
    }
  }

  /// Запустить таймер для автоматического переключения
  void _startAutoSwitchTimer() {
    _autoSwitchTimer?.cancel();
    
    if (_autoSwitchEnabled) {
      // Проверяем каждую минуту
      _autoSwitchTimer = Timer.periodic(const Duration(minutes: 1), (timer) {
        if (_autoSwitchEnabled) {
          final oldMode = _themeMode;
          _updateThemeBasedOnTime();
          
          if (oldMode != _themeMode) {
            print('🌓 Автоматическое переключение темы: $_themeMode');
            notifyListeners();
          }
        }
      });
    }
  }
}



