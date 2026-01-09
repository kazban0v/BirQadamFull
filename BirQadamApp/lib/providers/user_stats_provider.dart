// lib/providers/user_stats_provider.dart

import 'dart:convert';
import 'package:flutter/foundation.dart';
import '../models/user_stats.dart';
import '../config/app_config.dart';
import 'auth_provider.dart';
import '../services/api/auth_http_client.dart';

class UserStatsProvider with ChangeNotifier {
  final AuthProvider _authProvider;
  late final AuthHttpClient _httpClient;
  
  UserStats? _stats;
  bool _isLoading = false;
  String? _error;

  UserStatsProvider(this._authProvider) {
    _httpClient = AuthHttpClient(_authProvider);
  }

  UserStats? get stats => _stats;
  bool get isLoading => _isLoading;
  String? get error => _error;
  bool get hasData => _stats != null;

  /// Загрузить статистику текущего пользователя
  Future<void> fetchUserStats() async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final uri = Uri.parse('${AppConfig.apiBaseUrl}/custom-admin/api/v1/user/stats/');
      
      final response = await _httpClient.get(uri);

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        
        if (data['success'] == true && data['stats'] != null) {
          _stats = UserStats.fromJson(data['stats']);
          _error = null;
        } else {
          _error = data['error'] ?? 'Ошибка загрузки статистики';
        }
      } else {
        _error = 'Ошибка сервера: ${response.statusCode}';
      }
    } catch (e) {
      debugPrint('❌ Error fetching user stats: $e');
      _error = 'Ошибка подключения: $e';
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  /// Обновить статистику
  Future<void> refresh() async {
    await fetchUserStats();
  }

  /// Очистить данные
  void clear() {
    _stats = null;
    _error = null;
    _isLoading = false;
    notifyListeners();
  }
}

