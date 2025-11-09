import 'package:flutter/material.dart';
import 'dart:convert';
import '../models/achievement.dart';
import '../services/api/api_service.dart';
import 'auth_provider.dart';
import '../services/api/auth_http_client.dart';

class AchievementsProvider with ChangeNotifier {
  final AuthProvider _authProvider;
  late final AuthHttpClient _httpClient;

  List<Achievement> _achievements = [];
  UserProgress? _progress;
  bool _isLoading = false;
  String? _errorMessage;

  List<Achievement> get achievements => _achievements;
  UserProgress? get progress => _progress;
  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;

  AchievementsProvider(this._authProvider) {
    // ✅ Создаём HTTP клиент с автоматическим token refresh
    _httpClient = AuthHttpClient(_authProvider);
    _authProvider.addListener(_onAuthChanged);
  }

  void _onAuthChanged() {
    if (_authProvider.isAuthenticated) {
      loadAchievements();
    } else {
      _achievements = [];
      _progress = null;
      _errorMessage = null;
      notifyListeners();
    }
  }

  @override
  void dispose() {
    _authProvider.removeListener(_onAuthChanged);
    super.dispose();
  }

  Future<void> loadAchievements() async {
    if (!_authProvider.isAuthenticated) return;

    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      // ✅ Загрузка достижений через AuthHttpClient
      final achievementsResponse = await _httpClient.get(
        Uri.parse(ApiService.achievementsUrl),
      );

      // ✅ Загрузка прогресса через AuthHttpClient
      final progressResponse = await _httpClient.get(
        Uri.parse(ApiService.userProgressUrl),
      );

      if (achievementsResponse.statusCode == 200) {
        final data = jsonDecode(achievementsResponse.body);
        _achievements = (data as List)
            .map((achievement) => Achievement.fromJson(achievement))
            .toList();
      } else {
        _errorMessage = 'Ошибка загрузки достижений';
      }

      if (progressResponse.statusCode == 200) {
        final data = jsonDecode(progressResponse.body);
        _progress = UserProgress.fromJson(data);
      }
    } catch (e) {
      _errorMessage = 'Ошибка подключения: $e';
      print('Ошибка загрузки достижений: $e');
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  void clearError() {
    _errorMessage = null;
    notifyListeners();
  }

  // Вспомогательные методы
  List<Achievement> get unlockedAchievements =>
      _achievements.where((a) => a.isUnlocked).toList();

  List<Achievement> get lockedAchievements =>
      _achievements.where((a) => !a.isUnlocked).toList();

  int get totalXp => _achievements
      .where((a) => a.isUnlocked)
      .fold(0, (sum, a) => sum + a.xp);
}
