import 'package:flutter/material.dart';
import 'dart:convert';
import '../models/project_marker.dart';
import '../config/app_config.dart';
import 'auth_provider.dart';
import '../services/api/auth_http_client.dart';

/// Provider для управления картой проектов
class MapProvider extends ChangeNotifier {
  final AuthProvider _authProvider;
  late final AuthHttpClient _httpClient;

  List<ProjectMarker> _markers = [];
  bool _isLoading = false;
  String? _error;

  // Фильтры
  String? _selectedType;
  String? _selectedCity;
  DateTime? _dateFrom;
  DateTime? _dateTo;

  MapProvider(this._authProvider) {
    _httpClient = AuthHttpClient(_authProvider);
    _authProvider.addListener(_onAuthChanged);
  }

  void _onAuthChanged() {
    if (_authProvider.isAuthenticated) {
      // Перезагружаем маркеры при смене авторизации
      if (_markers.isEmpty) {
        loadMarkers();
      }
    } else {
      // Очищаем маркеры при выходе
      _markers = [];
      notifyListeners();
    }
  }

  @override
  void dispose() {
    _authProvider.removeListener(_onAuthChanged);
    super.dispose();
  }

  // Getters
  List<ProjectMarker> get markers => _markers;
  bool get isLoading => _isLoading;
  String? get error => _error;
  String? get selectedType => _selectedType;
  String? get selectedCity => _selectedCity;
  DateTime? get dateFrom => _dateFrom;
  DateTime? get dateTo => _dateTo;

  /// Получить маркеры проектов с API
  Future<void> loadMarkers() async {
    if (!_authProvider.isAuthenticated) {
      _error = 'Требуется авторизация';
      return;
    }

    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      // Строим URL с фильтрами
      String url = '${AppConfig.customAdminApiUrl}/map/projects/';
      List<String> params = [];

      if (_selectedType != null && _selectedType!.isNotEmpty) {
        params.add('type=$_selectedType');
      }

      if (_selectedCity != null && _selectedCity!.isNotEmpty) {
        params.add('city=$_selectedCity');
      }

      if (_dateFrom != null) {
        params.add('date_from=${_dateFrom!.toIso8601String().split('T')[0]}');
      }

      if (_dateTo != null) {
        params.add('date_to=${_dateTo!.toIso8601String().split('T')[0]}');
      }

      if (params.isNotEmpty) {
        url += '?' + params.join('&');
      }

      // Выполняем запрос через AuthHttpClient (автоматический refresh токена)
      final response = await _httpClient.get(Uri.parse(url));

      if (response.statusCode == 200) {
        final data = jsonDecode(utf8.decode(response.bodyBytes));

        if (data['success'] == true) {
          _markers = (data['markers'] as List)
              .map((m) => ProjectMarker.fromJson(m))
              .toList();
          _error = null;
        } else {
          _error = data['error'] ?? 'Ошибка при загрузке карты';
        }
      } else if (response.statusCode == 401) {
        _error = 'Требуется авторизация';
      } else {
        _error = 'Ошибка сервера: ${response.statusCode}';
      }
    } catch (e) {
      _error = 'Ошибка при загрузке карты: ${e.toString()}';
      debugPrint('Error loading markers: $e');
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  /// Установить фильтр по типу волонтерства
  void setTypeFilter(String? type) {
    if (_selectedType != type) {
      _selectedType = type;
      loadMarkers();
    }
  }

  /// Установить фильтр по городу
  void setCityFilter(String? city) {
    if (_selectedCity != city) {
      _selectedCity = city;
      loadMarkers();
    }
  }

  /// Установить фильтр по дате
  void setDateFilter({DateTime? from, DateTime? to}) {
    bool changed = false;

    if (_dateFrom != from) {
      _dateFrom = from;
      changed = true;
    }

    if (_dateTo != to) {
      _dateTo = to;
      changed = true;
    }

    if (changed) {
      loadMarkers();
    }
  }

  /// Очистить все фильтры
  void clearFilters() {
    bool changed = false;

    if (_selectedType != null ||
        _selectedCity != null ||
        _dateFrom != null ||
        _dateTo != null) {
      _selectedType = null;
      _selectedCity = null;
      _dateFrom = null;
      _dateTo = null;
      changed = true;
    }

    if (changed) {
      loadMarkers();
    }
  }

  /// Проверить есть ли активные фильтры
  bool get hasActiveFilters {
    return _selectedType != null ||
        _selectedCity != null ||
        _dateFrom != null ||
        _dateTo != null;
  }

  /// Получить количество активных фильтров
  int get activeFiltersCount {
    int count = 0;
    if (_selectedType != null) count++;
    if (_selectedCity != null) count++;
    if (_dateFrom != null) count++;
    if (_dateTo != null) count++;
    return count;
  }

  /// Получить список уникальных городов из маркеров
  List<String> get availableCities {
    return _markers.map((m) => m.city).toSet().toList()..sort();
  }

  /// Очистить ошибку
  void clearError() {
    _error = null;
    notifyListeners();
  }
}

