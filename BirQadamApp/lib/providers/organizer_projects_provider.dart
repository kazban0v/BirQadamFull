import 'package:flutter/material.dart';
import 'dart:convert';
import '../config/app_config.dart';
import 'auth_provider.dart';
import '../services/api/auth_http_client.dart';

// Модель проекта для организатора
class OrganizerProject {
  final int id;
  final String title;
  final String description;
  final String city;
  final String status;
  final int volunteerCount;
  final int taskCount;
  final String createdAt;
  final String volunteerType;

  OrganizerProject({
    required this.id,
    required this.title,
    required this.description,
    required this.city,
    required this.status,
    required this.volunteerCount,
    required this.taskCount,
    required this.createdAt,
    this.volunteerType = 'environmental',
  });

  factory OrganizerProject.fromJson(Map<String, dynamic> json) {
    return OrganizerProject(
      id: json['id'],
      title: json['title'],
      description: json['description'],
      city: json['city'],
      status: json['status'],
      volunteerCount: json['volunteer_count'] ?? 0,
      taskCount: json['task_count'] ?? 0,
      createdAt: json['created_at'] ?? '',
      volunteerType: json['volunteer_type'] ?? 'environmental',
    );
  }

  OrganizerProject copyWith({
    int? id,
    String? title,
    String? description,
    String? city,
    String? status,
    int? volunteerCount,
    int? taskCount,
    String? createdAt,
    String? volunteerType,
  }) {
    return OrganizerProject(
      id: id ?? this.id,
      title: title ?? this.title,
      description: description ?? this.description,
      city: city ?? this.city,
      status: status ?? this.status,
      volunteerCount: volunteerCount ?? this.volunteerCount,
      taskCount: taskCount ?? this.taskCount,
      createdAt: createdAt ?? this.createdAt,
      volunteerType: volunteerType ?? this.volunteerType,
    );
  }
}

// Модель участника проекта
class ProjectParticipant {
  final int id;
  final String name;
  final String email;
  final int rating;
  final String joinedAt;
  final int completedTasks;
  final int totalTasks;

  ProjectParticipant({
    required this.id,
    required this.name,
    required this.email,
    required this.rating,
    required this.joinedAt,
    required this.completedTasks,
    required this.totalTasks,
  });

  factory ProjectParticipant.fromJson(Map<String, dynamic> json) {
    return ProjectParticipant(
      id: json['id'],
      name: json['name'],
      email: json['email'],
      rating: json['rating'] ?? 0,
      joinedAt: json['joined_at'] ?? '',
      completedTasks: json['completed_tasks'] ?? 0,
      totalTasks: json['total_tasks'] ?? 0,
    );
  }
}

class OrganizerProjectsProvider with ChangeNotifier {
  final AuthProvider _authProvider;
  late final AuthHttpClient _httpClient;

  List<OrganizerProject> _projects = [];
  bool _isLoading = false;
  String? _errorMessage;

  List<OrganizerProject> get projects => _projects;
  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;

  OrganizerProjectsProvider(this._authProvider) {
    // ✅ Создаём HTTP клиент с автоматическим token refresh
    _httpClient = AuthHttpClient(_authProvider);
    // Слушаем изменения в аутентификации
    _authProvider.addListener(_onAuthChanged);
  }

  void _onAuthChanged() {
    if (_authProvider.isAuthenticated && _authProvider.role == 'organizer') {
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
    if (!_authProvider.isAuthenticated || _authProvider.role != 'organizer') return;

    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      // ✅ Используем AuthHttpClient с автоматическим token refresh
      final response = await _httpClient.get(
        Uri.parse('${_getBaseUrl()}/custom-admin/api/organizer/projects/'),
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        _projects = (data['projects'] as List)
            .map((project) => OrganizerProject.fromJson(project))
            .toList();
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

  Future<bool> createProject({
    required String title,
    required String description,
    required String city,
    double? latitude,
    double? longitude,
    String volunteerType = 'environmental',
  }) async {
    print('🔍 createProject called');
    print('   isAuthenticated: ${_authProvider.isAuthenticated}');
    print('   role: ${_authProvider.role}');
    print('   token: ${_authProvider.token}');
    print('   user: ${_authProvider.user?.name}');

    if (!_authProvider.isAuthenticated || _authProvider.role != 'organizer') {
      print('❌ Not authenticated or not organizer');
      return false;
    }

    // Проверяем наличие токена
    final token = _authProvider.token;
    if (token == null || token.isEmpty) {
      print('❌ Token is null or empty!');
      _errorMessage = 'Нет токена авторизации. Пожалуйста, войдите снова';
      notifyListeners();
      return false;
    }

    _isLoading = true;
    notifyListeners();

    try {
      final requestData = {
        'title': title,
        'description': description,
        'city': city,
        'volunteer_type': volunteerType,
      };

      if (latitude != null && longitude != null) {
        requestData['latitude'] = latitude.toString();
        requestData['longitude'] = longitude.toString();
      }

      print('🔍 Creating project with token: ${token.substring(0, 50)}...');
      print('📦 Request data: $requestData');

      // ✅ Используем AuthHttpClient с автоматическим token refresh
      final response = await _httpClient.post(
        Uri.parse('${_getBaseUrl()}/custom-admin/api/organizer/projects/'),
        headers: {
          'Authorization': 'Bearer $token',  // Здесь используется локальная переменная token
        },
        body: jsonEncode(requestData),
      );

      print('📡 Response status: ${response.statusCode}');
      print('📄 Response body: ${response.body}');

      if (response.statusCode == 201) {
        _errorMessage = null;
        await loadProjects(); // Перезагружаем список проектов
        notifyListeners();
        return true;
      } else if (response.statusCode == 401) {
        // Токен истёк, пробуем обновить
        print('⚠️ Token expired, attempting to refresh...');
        final refreshed = await _authProvider.refreshAccessToken();
        if (refreshed) {
          // Повторяем запрос с новым токеном
          print('✅ Token refreshed, retrying request...');
          return await createProject(
            title: title,
            description: description,
            city: city,
            latitude: latitude,
            longitude: longitude,
            volunteerType: volunteerType,
          );
        } else {
          _errorMessage = 'Сессия истекла. Пожалуйста, войдите снова';
          notifyListeners();
          return false;
        }
      } else {
        final data = jsonDecode(response.body);
        _errorMessage = data['error'] ?? 'Ошибка при создании проекта';
        notifyListeners();
        return false;
      }
    } catch (e) {
      _errorMessage = 'Ошибка подключения: $e';
      notifyListeners();
      return false;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<bool> updateProject(int projectId, Map<String, dynamic> projectData) async {
    if (!_authProvider.isAuthenticated || _authProvider.role != 'organizer') return false;

    try {
      // ✅ Используем AuthHttpClient с автоматическим token refresh
      final response = await _httpClient.put(
        Uri.parse('${_getBaseUrl()}/custom-admin/api/projects/$projectId/manage/'),
        body: jsonEncode(projectData),
      );

      if (response.statusCode == 200) {
        jsonDecode(response.body);
        _errorMessage = null;
        await loadProjects(); // Перезагружаем список проектов
        notifyListeners();
        return true;
      } else {
        final data = jsonDecode(response.body);
        _errorMessage = data['error'] ?? 'Ошибка при обновлении проекта';
        notifyListeners();
        return false;
      }
    } catch (e) {
      _errorMessage = 'Ошибка подключения: $e';
      notifyListeners();
      return false;
    }
  }

  Future<bool> deleteProject(int projectId) async {
    if (!_authProvider.isAuthenticated || _authProvider.role != 'organizer') return false;

    try {
      // ✅ Используем AuthHttpClient с автоматическим token refresh
      final response = await _httpClient.delete(
        Uri.parse('${_getBaseUrl()}/custom-admin/api/projects/$projectId/manage/'),
      );

      if (response.statusCode == 200) {
        jsonDecode(response.body);
        _errorMessage = null;
        await loadProjects(); // Перезагружаем список проектов
        notifyListeners();
        return true;
      } else {
        final data = jsonDecode(response.body);
        _errorMessage = data['error'] ?? 'Ошибка при удалении проекта';
        notifyListeners();
        return false;
      }
    } catch (e) {
      _errorMessage = 'Ошибка подключения: $e';
      notifyListeners();
      return false;
    }
  }

  Future<List<ProjectParticipant>> loadProjectParticipants(int projectId) async {
    if (!_authProvider.isAuthenticated || _authProvider.role != 'organizer') return [];

    try {
      // ✅ Используем AuthHttpClient с автоматическим token refresh
      final response = await _httpClient.get(
        Uri.parse('${_getBaseUrl()}/custom-admin/api/projects/$projectId/participants/'),
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        return (data['participants'] as List)
            .map((participant) => ProjectParticipant.fromJson(participant))
            .toList();
      } else {
        return [];
      }
    } catch (e) {
      print('Ошибка загрузки участников: $e');
      return [];
    }
  }

  Future<bool> createTask(int projectId, {
    required String text,
    String? deadlineDate,
    String? startTime,
    String? endTime,
  }) async {
    if (!_authProvider.isAuthenticated || _authProvider.role != 'organizer') return false;

    try {
      final requestData = {'text': text};
      if (deadlineDate != null) requestData['deadline_date'] = deadlineDate;
      if (startTime != null) requestData['start_time'] = startTime;
      if (endTime != null) requestData['end_time'] = endTime;

      // ✅ Используем AuthHttpClient с автоматическим token refresh
      final response = await _httpClient.post(
        Uri.parse('${_getBaseUrl()}/custom-admin/api/projects/$projectId/tasks/'),
        body: jsonEncode(requestData),
      );

      if (response.statusCode == 201) {
        jsonDecode(response.body);
        _errorMessage = null;
        await loadProjects(); // Обновляем счетчики задач
        notifyListeners();
        return true;
      } else {
        final data = jsonDecode(response.body);
        _errorMessage = data['error'] ?? 'Ошибка при создании задачи';
        notifyListeners();
        return false;
      }
    } catch (e) {
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