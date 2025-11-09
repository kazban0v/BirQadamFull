import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';
import '../models/activity.dart';
import '../services/api/api_service.dart';
import 'auth_provider.dart';

class ActivityProvider with ChangeNotifier {
  final AuthProvider _authProvider;

  List<Activity> _activities = [];
  bool _isLoading = false;
  String? _errorMessage;

  List<Activity> get activities => _activities;
  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;

  ActivityProvider(this._authProvider) {
    _authProvider.addListener(_onAuthChanged);
  }

  void _onAuthChanged() {
    if (_authProvider.isAuthenticated) {
      loadActivities();
    } else {
      _activities = [];
      _errorMessage = null;
      notifyListeners();
    }
  }

  @override
  void dispose() {
    _authProvider.removeListener(_onAuthChanged);
    super.dispose();
  }

  Future<void> loadActivities() async {
    if (!_authProvider.isAuthenticated) return;

    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final response = await http.get(
        Uri.parse(ApiService.activitiesUrl),
        headers: {
          'Authorization': 'Bearer ${_authProvider.token}',
          'Content-Type': 'application/json',
        },
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        _activities = (data as List)
            .map((activity) => Activity.fromJson(activity))
            .toList();
        _errorMessage = null;
      } else {
        _errorMessage = 'Ошибка загрузки активности';
      }
    } catch (e) {
      _errorMessage = 'Ошибка подключения: $e';
      print('Ошибка загрузки активности: $e');
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  void clearError() {
    _errorMessage = null;
    notifyListeners();
  }

  // Получить последние N активностей
  List<Activity> getRecentActivities(int count) {
    return _activities.take(count).toList();
  }
}
