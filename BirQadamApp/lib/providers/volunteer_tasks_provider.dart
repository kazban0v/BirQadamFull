import 'package:flutter/material.dart';
import 'dart:convert';
import 'auth_provider.dart';
import '../services/api/api_service.dart';
import '../services/api/auth_http_client.dart';

// Модель задания
class Task {
  final int id;
  final String projectTitle;
  final String text;
  final String? deadlineDate;
  final String? startTime;
  final String? endTime;
  final String status;
  final String creatorName;
  final bool isAssigned;
  final bool assignmentStatus;

  Task({
    required this.id,
    required this.projectTitle,
    required this.text,
    this.deadlineDate,
    this.startTime,
    this.endTime,
    required this.status,
    required this.creatorName,
    required this.isAssigned,
    required this.assignmentStatus,
  });

  factory Task.fromJson(Map<String, dynamic> json) {
    return Task(
      id: int.tryParse(json['id'].toString()) ?? 0,
      projectTitle: json['project_title'] ?? '',
      text: json['text'] ?? '',
      deadlineDate: json['deadline_date'],
      startTime: json['start_time'],
      endTime: json['end_time'],
      status: json['status'] ?? '',
      creatorName: json['creator_name'] ?? '',
      isAssigned: json['is_assigned'] ?? false,
      assignmentStatus: json['assignment_status'] ?? false,
    );
  }

  Task copyWith({
    int? id,
    String? projectTitle,
    String? text,
    String? deadlineDate,
    String? startTime,
    String? endTime,
    String? status,
    String? creatorName,
    bool? isAssigned,
    bool? assignmentStatus,
  }) {
    return Task(
      id: id ?? this.id,
      projectTitle: projectTitle ?? this.projectTitle,
      text: text ?? this.text,
      deadlineDate: deadlineDate ?? this.deadlineDate,
      startTime: startTime ?? this.startTime,
      endTime: endTime ?? this.endTime,
      status: status ?? this.status,
      creatorName: creatorName ?? this.creatorName,
      isAssigned: isAssigned ?? this.isAssigned,
      assignmentStatus: assignmentStatus ?? this.assignmentStatus,
    );
  }
}

class VolunteerTasksProvider with ChangeNotifier {
  final AuthProvider _authProvider;
  late final AuthHttpClient _httpClient;

  List<Task> _tasks = [];
  bool _isLoading = false;
  String? _errorMessage;

  List<Task> get tasks => _tasks;
  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;

  VolunteerTasksProvider(this._authProvider) {
    // Создаём HTTP клиент с автоматическим token refresh
    _httpClient = AuthHttpClient(_authProvider);
    // Слушаем изменения в аутентификации
    _authProvider.addListener(_onAuthChanged);
  }

  void _onAuthChanged() {
    if (_authProvider.isAuthenticated) {
      loadTasks();
    } else {
      _tasks = [];
      _errorMessage = null;
      notifyListeners();
    }
  }

  @override
  void dispose() {
    _authProvider.removeListener(_onAuthChanged);
    super.dispose();
  }

  Future<void> loadTasks() async {
    if (!_authProvider.isAuthenticated) return;

    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      // ✅ Используем AuthHttpClient с автоматическим token refresh
      final response = await _httpClient.get(
        Uri.parse(ApiService.tasksUrl),
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        _tasks = (data as List)
            .map((task) => Task.fromJson(task))
            .toList();
        _errorMessage = null;
      } else {
        _errorMessage = 'Ошибка загрузки заданий';
      }
    } catch (e) {
      _errorMessage = 'Ошибка подключения: $e';
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  void clearError() {
    _errorMessage = null;
    notifyListeners();
  }

  // Вспомогательные методы для работы с задачами
  List<Task> get assignedTasks => _tasks.where((task) => task.isAssigned).toList();
  List<Task> get availableTasks => _tasks.where((task) => !task.isAssigned).toList();

  int get completedTasksCount => _tasks.where((task) => task.status == 'completed').length;
  int get inProgressTasksCount => _tasks.where((task) => task.status == 'in_progress').length;
  int get openTasksCount => _tasks.where((task) => task.status == 'open').length;

  // Метод для принятия задачи
  Future<bool> acceptTask(int taskId) async {
    if (!_authProvider.isAuthenticated) return false;

    try {
      // ✅ Используем AuthHttpClient с автоматическим token refresh
      final response = await _httpClient.post(
        Uri.parse(ApiService.acceptTaskUrl(taskId)),
      );

      if (response.statusCode == 200) {
        // Обновляем состояние задачи локально
        final index = _tasks.indexWhere((task) => task.id == taskId);
        if (index != -1) {
          _tasks[index] = _tasks[index].copyWith(isAssigned: true);
          notifyListeners();
        }
        return true;
      }
    } catch (e) {
      _errorMessage = 'Ошибка подключения: $e';
      notifyListeners();
    }
    return false;
  }

  // Метод для отклонения задачи
  Future<bool> declineTask(int taskId) async {
    if (!_authProvider.isAuthenticated) return false;

    try {
      // ✅ Используем AuthHttpClient с автоматическим token refresh
      final response = await _httpClient.post(
        Uri.parse(ApiService.declineTaskUrl(taskId)),
      );

      if (response.statusCode == 200) {
        // Удаляем задачу из списка, так как она отклонена
        _tasks.removeWhere((task) => task.id == taskId);
        notifyListeners();
        return true;
      }
    } catch (e) {
      _errorMessage = 'Ошибка подключения: $e';
      notifyListeners();
    }
    return false;
  }
}