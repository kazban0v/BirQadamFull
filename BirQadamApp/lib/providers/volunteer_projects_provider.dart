import 'package:flutter/material.dart';
import 'dart:convert';
import '../config/app_config.dart';
import 'auth_provider.dart';
import '../services/api/auth_http_client.dart';

// Модель проекта
class Project {
  final int id;
  final String title;
  final String description;
  final String city;
  final String? startDate;
  final String? endDate;
  final String creatorName;
  final int volunteerCount;
  final int taskCount;
  final bool isJoined;
  final String volunteerType;

  Project({
    required this.id,
    required this.title,
    required this.description,
    required this.city,
    this.startDate,
    this.endDate,
    required this.creatorName,
    required this.volunteerCount,
    required this.taskCount,
    required this.isJoined,
    this.volunteerType = 'environmental',
  });

  factory Project.fromJson(Map<String, dynamic> json) {
    return Project(
      id: int.tryParse(json['id'].toString()) ?? 0,
      title: json['title'] ?? '',
      description: json['description'] ?? '',
      city: json['city'] ?? '',
      startDate: json['start_date'],
      endDate: json['end_date'],
      creatorName: json['creator_name'] ?? '',
      volunteerCount: int.tryParse(json['volunteer_count'].toString()) ?? 0,
      taskCount: int.tryParse(json['task_count'].toString()) ?? 0,
      isJoined: json['is_joined'] ?? false,
      volunteerType: json['volunteer_type'] ?? 'environmental',
    );
  }

  Project copyWith({
    int? id,
    String? title,
    String? description,
    String? city,
    String? startDate,
    String? endDate,
    String? creatorName,
    int? volunteerCount,
    int? taskCount,
    bool? isJoined,
    String? volunteerType,
  }) {
    return Project(
      id: id ?? this.id,
      title: title ?? this.title,
      description: description ?? this.description,
      city: city ?? this.city,
      startDate: startDate ?? this.startDate,
      endDate: endDate ?? this.endDate,
      creatorName: creatorName ?? this.creatorName,
      volunteerCount: volunteerCount ?? this.volunteerCount,
      taskCount: taskCount ?? this.taskCount,
      isJoined: isJoined ?? this.isJoined,
      volunteerType: volunteerType ?? this.volunteerType,
    );
  }
}

class VolunteerProjectsProvider with ChangeNotifier {
  final AuthProvider _authProvider;
  late final AuthHttpClient _httpClient;

  List<Project> _projects = [];
  bool _isLoading = false;
  String? _errorMessage;

  List<Project> get projects => _projects;
  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;

  VolunteerProjectsProvider(this._authProvider) {
    // ✅ Создаём HTTP клиент с автоматическим token refresh
    _httpClient = AuthHttpClient(_authProvider);
    // Слушаем изменения в аутентификации
    _authProvider.addListener(_onAuthChanged);
  }

  void _onAuthChanged() {
    if (_authProvider.isAuthenticated) {
      loadProjects();
    } else {
      _projects = [];
      _errorMessage = null;
      notifyListeners();
    }
  }

  @override
  void dispose() {
    _authProvider.removeListener(_onAuthChanged);
    super.dispose();
  }

  String _getBaseUrl() {
    // Используем конфигурацию из app_config.dart
    return AppConfig.apiBaseUrl;
  }

  Future<void> loadProjects() async {
    if (!_authProvider.isAuthenticated) return;

    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      // ✅ Используем AuthHttpClient с автоматическим token refresh
      final response = await _httpClient.get(
        Uri.parse('${_getBaseUrl()}/custom-admin/api/projects/'),
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        final projectsData = data as List;
        _projects = projectsData.map((project) => Project.fromJson(project)).toList();
        _errorMessage = null;
      } else {
        _errorMessage = 'Ошибка загрузки проектов';
      }
    } catch (e) {
      _errorMessage = 'Ошибка подключения: $e';
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<bool> joinProject(int projectId) async {
    if (!_authProvider.isAuthenticated) return false;

    // Optimistic update
    final projectIndex = _projects.indexWhere((p) => p.id == projectId);
    if (projectIndex != -1) {
      _projects[projectIndex] = _projects[projectIndex].copyWith(isJoined: true);
      notifyListeners();
    }

    try {
      // ✅ Используем AuthHttpClient с автоматическим token refresh
      final response = await _httpClient.post(
        Uri.parse('${_getBaseUrl()}/custom-admin/api/projects/$projectId/join/'),
      );

      if (response.statusCode == 200 || response.statusCode == 201) {
        // 200 - уже присоединён, 201 - успешно присоединился
        _errorMessage = null;
        notifyListeners();
        return true;
      } else {
        // Revert optimistic update
        if (projectIndex != -1) {
          _projects[projectIndex] = _projects[projectIndex].copyWith(isJoined: false);
        }
        final data = jsonDecode(response.body);
        _errorMessage = data['error'] ?? 'Ошибка при присоединении';
        notifyListeners();
        return false;
      }
    } catch (e) {
      // Revert optimistic update
      if (projectIndex != -1) {
        _projects[projectIndex] = _projects[projectIndex].copyWith(isJoined: false);
      }
      _errorMessage = 'Ошибка подключения: $e';
      notifyListeners();
      return false;
    }
  }

  Future<bool> leaveProject(int projectId) async {
    if (!_authProvider.isAuthenticated) return false;

    // Optimistic update
    final projectIndex = _projects.indexWhere((p) => p.id == projectId);
    if (projectIndex != -1) {
      _projects[projectIndex] = _projects[projectIndex].copyWith(isJoined: false);
      notifyListeners();
    }

    try {
      // ✅ Используем AuthHttpClient с автоматическим token refresh
      final response = await _httpClient.post(
        Uri.parse('${_getBaseUrl()}/custom-admin/api/projects/$projectId/leave/'),
      );

      if (response.statusCode == 200) {
        _errorMessage = null;
        notifyListeners();
        return true;
      } else {
        // Revert optimistic update
        if (projectIndex != -1) {
          _projects[projectIndex] = _projects[projectIndex].copyWith(isJoined: true);
        }
        try {
          final data = jsonDecode(response.body);
          _errorMessage = data['error'] ?? 'Ошибка при выходе из проекта';
        } catch (_) {
          _errorMessage = 'Ошибка при выходе из проекта';
        }
        notifyListeners();
        return false;
      }
    } catch (e) {
      // Revert optimistic update
      if (projectIndex != -1) {
        _projects[projectIndex] = _projects[projectIndex].copyWith(isJoined: true);
      }
      _errorMessage = 'Ошибка подключения: $e';
      notifyListeners();
      return false;
    }
  }

  void clearError() {
    _errorMessage = null;
    notifyListeners();
  }
}