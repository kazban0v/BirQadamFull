import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';
import 'dart:io';
import '../models/photo_report.dart';
import '../services/api/api_service.dart';
import 'auth_provider.dart';

class PhotoReportsProvider with ChangeNotifier {
  final AuthProvider _authProvider;

  List<PhotoReport> _photoReports = [];
  bool _isLoading = false;
  String? _errorMessage;
  int _newCount = 0;

  List<PhotoReport> get photoReports => _photoReports;
  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;
  int get newCount => _newCount;

  PhotoReportsProvider(this._authProvider) {
    // Слушаем изменения в аутентификации
    _authProvider.addListener(_onAuthChanged);
  }

  void _onAuthChanged() {
    if (_authProvider.isAuthenticated) {
      // Загружаем фотоотчеты для обеих ролей
      loadPhotoReports();
    } else {
      _photoReports = [];
      _newCount = 0;
      _errorMessage = null;
      notifyListeners();
    }
  }

  @override
  void dispose() {
    _authProvider.removeListener(_onAuthChanged);
    super.dispose();
  }

  /// Загрузка фотоотчетов для организатора и волонтера
  Future<void> loadPhotoReports({String filter = 'all'}) async {
    if (!_authProvider.isAuthenticated) return;

    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      // Используем разные URL для организатора и волонтера
      final String apiUrl = _authProvider.role == 'organizer'
          ? '${ApiService.organizerPhotoReportsUrl}?filter=$filter'
          : '${ApiService.volunteerPhotoReportsUrl}?filter=$filter';
      
      final uri = Uri.parse(apiUrl);
      final response = await http.get(
        uri,
        headers: {
          'Authorization': 'Bearer ${_authProvider.token}',
          'Content-Type': 'application/json',
        },
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        _photoReports = (data['photos'] as List)
            .map((photo) => PhotoReport.fromJson(photo))
            .toList();
        _newCount = data['new_count'] ?? 0;
        _errorMessage = null;
      } else {
        _errorMessage = 'Ошибка загрузки фотоотчетов';
      }
    } catch (e) {
      _errorMessage = 'Ошибка подключения: $e';
      debugPrint('❌ Ошибка загрузки фотоотчетов: $e');
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  /// Получить детали фотоотчета
  Future<PhotoReport?> getPhotoReportDetail(int photoId) async {
    if (!_authProvider.isAuthenticated) return null;

    try {
      final response = await http.get(
        Uri.parse(ApiService.photoReportDetailUrl(photoId)),
        headers: {
          'Authorization': 'Bearer ${_authProvider.token}',
          'Content-Type': 'application/json',
        },
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        return PhotoReport.fromJson(data);
      }
    } catch (e) {
      print('Ошибка загрузки деталей фотоотчета: $e');
    }
    return null;
  }

  /// Оценить фотоотчет (1-5 звезд)
  Future<bool> ratePhotoReport(int photoId, int rating, String? feedback) async {
    if (!_authProvider.isAuthenticated || _authProvider.role != 'organizer') return false;

    try {
      final response = await http.post(
        Uri.parse(ApiService.ratePhotoReportUrl(photoId)),
        headers: {
          'Authorization': 'Bearer ${_authProvider.token}',
          'Content-Type': 'application/json',
        },
        body: jsonEncode({
          'rating': rating,
          'feedback': feedback ?? '',
        }),
      );

      if (response.statusCode == 200) {
        _errorMessage = null;
        // Обновляем список после оценки
        await loadPhotoReports();
        return true;
      } else {
        final data = jsonDecode(response.body);
        _errorMessage = data['error'] ?? 'Ошибка при оценке фотоотчета';
        notifyListeners();
        return false;
      }
    } catch (e) {
      _errorMessage = 'Ошибка подключения: $e';
      notifyListeners();
      return false;
    }
  }

  /// Отклонить фотоотчет
  Future<bool> rejectPhotoReport(int photoId, String feedback) async {
    if (!_authProvider.isAuthenticated || _authProvider.role != 'organizer') return false;

    if (feedback.trim().isEmpty) {
      _errorMessage = 'Причина отклонения обязательна';
      notifyListeners();
      return false;
    }

    try {
      final response = await http.post(
        Uri.parse(ApiService.rejectPhotoReportUrl(photoId)),
        headers: {
          'Authorization': 'Bearer ${_authProvider.token}',
          'Content-Type': 'application/json',
        },
        body: jsonEncode({
          'feedback': feedback,
        }),
      );

      if (response.statusCode == 200) {
        _errorMessage = null;
        // Обновляем список после отклонения
        await loadPhotoReports();
        return true;
      } else {
        final data = jsonDecode(response.body);
        _errorMessage = data['error'] ?? 'Ошибка при отклонении фотоотчета';
        notifyListeners();
        return false;
      }
    } catch (e) {
      _errorMessage = 'Ошибка подключения: $e';
      notifyListeners();
      return false;
    }
  }

  /// Отправить фотоотчет (для волонтера)
  Future<bool> submitPhotoReport(int taskId, List<File> photos, String? comment) async {
    if (!_authProvider.isAuthenticated) return false;

    if (photos.isEmpty || photos.length > 5) {
      _errorMessage = 'Выберите от 1 до 5 фотографий';
      notifyListeners();
      return false;
    }

    try {
      var request = http.MultipartRequest(
        'POST',
        Uri.parse(ApiService.submitPhotoReportUrl(taskId)),
      );

      // Добавляем заголовки
      request.headers['Authorization'] = 'Bearer ${_authProvider.token}';

      // Добавляем фото
      for (var i = 0; i < photos.length; i++) {
        var photo = photos[i];
        var stream = http.ByteStream(photo.openRead());
        var length = await photo.length();
        var multipartFile = http.MultipartFile(
          'photos',
          stream,
          length,
          filename: 'photo_$i.jpg',
        );
        request.files.add(multipartFile);
      }

      // Добавляем комментарий если есть
      if (comment != null && comment.isNotEmpty) {
        request.fields['comment'] = comment;
      }

      // Отправляем запрос
      var streamedResponse = await request.send();
      var response = await http.Response.fromStream(streamedResponse);

      if (response.statusCode == 201) {
        _errorMessage = null;
        notifyListeners();
        return true;
      } else {
        final data = jsonDecode(response.body);
        _errorMessage = data['error'] ?? 'Ошибка при отправке фотоотчета';
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

  /// Получить фотоотчеты с фильтром
  List<PhotoReport> getFilteredReports(String filter) {
    if (filter == 'new') {
      return _photoReports.where((p) => p.status == 'pending').toList();
    }
    return _photoReports;
  }
}