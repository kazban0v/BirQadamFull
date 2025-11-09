import 'package:flutter/foundation.dart'; // для kDebugMode и ChangeNotifier
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';
import '../models/user_model.dart';
import '../services/api/api_service.dart';
import '../services/analytics/analytics_service.dart';  // ✅ СредП-16

class AuthProvider with ChangeNotifier {
  String? _token;
  String? _refreshToken;
  String? _role;
  UserModel? _user;
  bool _isLoading = false;
  String? _errorMessage;

  final _storage = const FlutterSecureStorage();

  String? get token => _token;
  String? get refreshToken => _refreshToken;
  String? get role => _role;
  UserModel? get user => _user;
  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;
  bool get isAuthenticated => _token != null && _role != null && _user != null;

  // Загрузка сохраненных данных аутентификации
  Future<void> loadAuthData() async {
    _token = await _storage.read(key: 'token');
    _refreshToken = await _storage.read(key: 'refresh_token');
    
    final prefs = await SharedPreferences.getInstance();
    _role = prefs.getString('role');
    final userJson = prefs.getString('user');
    if (userJson != null) {
      try {
        _user = UserModel.fromJson(jsonDecode(userJson));
      } catch (e) {
        print('Error loading user data: $e');
      }
    }

    // Проверяем валидность токена и обновляем при необходимости
    if (_token != null && _refreshToken != null) {
      print('🔍 Проверка валидности токена...');
      final isValid = await _validateToken();
      if (!isValid) {
        print('⚠️ Токен истёк, пробуем обновить...');
        final refreshed = await refreshAccessToken();
        if (!refreshed) {
          print('❌ Не удалось обновить токен, очищаем данные');
          await clearAuthData();
        }
      } else {
        print('✅ Токен валиден');
      }
    }

    notifyListeners();
  }

  // Проверка валидности токена
  Future<bool> _validateToken() async {
    if (_token == null) return false;

    try {
      final response = await http.get(
        Uri.parse(ApiService.profileUrl),
        headers: {
          'Authorization': 'Bearer $_token',
          'Content-Type': 'application/json',
        },
      );

      return response.statusCode == 200;
    } catch (e) {
      print('❌ Ошибка проверки токена: $e');
      return false;
    }
  }

  // Сохранение данных аутентификации
  Future<void> _saveAuthData(String token, String role, Map<String, dynamic> userData, {String? refreshToken}) async {
    await _storage.write(key: 'token', value: token);
    
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('role', role);
    await prefs.setString('user', jsonEncode(userData));

    if (refreshToken != null) {
      await _storage.write(key: 'refresh_token', value: refreshToken);
      _refreshToken = refreshToken;
    }

    _token = token;
    _role = role;
    _user = UserModel.fromJson(userData);

    // ИСПРАВЛЕНО: Не логируем токены в production
    if (kDebugMode) {
      print('✅ AuthProvider: Данные сохранены (role: $role)');
      print('👤 User: ${_user?.name}, approved: ${_user?.isApproved}');
      print('🔐 isAuthenticated = $isAuthenticated');
    }

    notifyListeners();
    if (kDebugMode) {
      print('📢 AuthProvider: notifyListeners() вызван');
    }
  }

  // Очистка данных аутентификации
  Future<void> clearAuthData() async {
    // ✅ ИСПРАВЛЕНИЕ СредП-16: Analytics для выхода
    await AnalyticsService().logLogout();
    await AnalyticsService().clearUserData();
    
    await _storage.delete(key: 'token');
    await _storage.delete(key: 'refresh_token');

    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('role');
    await prefs.remove('user');
    _token = null;
    _role = null;
    _user = null;
    _errorMessage = null;
    notifyListeners();
  }

  // Вход в систему
  Future<bool> login(String email, String password) async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      print('🔄 Начинаем вход...');
      print('📧 Email: $email');
      final url = ApiService.loginUrl;
      print('🌐 URL: $url');
      final response = await http.post(
        Uri.parse(url),
        headers: {
          'Content-Type': 'application/json',
        },
        body: jsonEncode({
          'username': email,
          'password': password,
        }),
      );
      print('📡 Статус ответа: ${response.statusCode}');
      print('📄 Тело ответа: ${response.body}');

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        final token = data['access'];  // Используем JWT access token
        final refresh = data['refresh'];  // Сохраняем refresh token
        final userData = data['user'];
        final role = userData['role'];

        if (token != null && role != null && userData != null) {
          await _saveAuthData(token, role, userData, refreshToken: refresh);
          
          // ✅ ИСПРАВЛЕНИЕ СредП-16: Analytics для входа
          await AnalyticsService().logLogin(method: 'email');
          await AnalyticsService().setUserId(userData['id'].toString());
          await AnalyticsService().setUserProperties(
            role: role,
            rating: userData['rating'],
          );
          
          _isLoading = false;
          notifyListeners();
          return true;
        } else {
          _errorMessage = 'Неверный ответ сервера';
        }
      } else {
        final data = jsonDecode(response.body);
        _errorMessage = data['error'] ?? 'Ошибка входа';
      }
    } catch (e) {
      print('❌ Ошибка: $e');
      _errorMessage = 'Ошибка подключения: $e';
    }

    _isLoading = false;
    notifyListeners();
    return false;
  }

  // Регистрация
  Future<bool> register(String email, String password, String name, String phone, String role, {String? organizationName}) async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final requestData = {
        'name': name,
        'email': email,
        'phone': phone,
        'password1': password,
        'password2': password,
        'role': role,
        'registration_source': 'mobile_app',
      };
      
      // Добавляем organization_name если роль организатор
      if (role == 'organizer' && organizationName != null && organizationName.isNotEmpty) {
        requestData['organization_name'] = organizationName;
      }

      final response = await http.post(
        Uri.parse(ApiService.registerUrl),
        headers: {
          'Content-Type': 'application/json',
        },
        body: jsonEncode(requestData),
      );

      print('📡 Register response: ${response.statusCode}');
      print('📄 Register body: ${response.body}');

      if (response.statusCode == 201) {
        final data = jsonDecode(response.body);
        final token = data['access'];  // Используем JWT access token
        final refresh = data['refresh'];  // Сохраняем refresh token
        final userData = data['user'];

        if (token != null && userData != null) {
          await _saveAuthData(token, role, userData, refreshToken: refresh);
          
          // ✅ ИСПРАВЛЕНИЕ СредП-16: Analytics для регистрации
          await AnalyticsService().logSignUp(method: 'email', role: role);
          await AnalyticsService().setUserId(userData['id'].toString());
          await AnalyticsService().setUserProperties(role: role);
          
          _isLoading = false;
          notifyListeners();
          return true;
        } else {
          _errorMessage = 'Неверный ответ сервера';
        }
      } else {
        final data = jsonDecode(response.body);
        _errorMessage = data['error'] ?? 'Ошибка регистрации';
      }
    } catch (e) {
      print('❌ Register error: $e');
      _errorMessage = 'Ошибка подключения: $e';
    }

    _isLoading = false;
    notifyListeners();
    return false;
  }

  // Выход из системы
  Future<void> logout() async {
    await clearAuthData();
  }

  // Обновление информации о пользователе
  Future<bool> refreshUser() async {
    if (_token == null) return false;

    try {
      final response = await http.get(
        Uri.parse(ApiService.profileUrl),
        headers: {
          'Authorization': 'Bearer $_token',
          'Content-Type': 'application/json',
        },
      );

      print('📡 Refresh user response: ${response.statusCode}');

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        _user = UserModel.fromJson(data);

        // Save updated user data
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString('user', jsonEncode(data));

        notifyListeners();
        return true;
      }
    } catch (e) {
      print('❌ Error refreshing user: $e');
    }
    return false;
  }

  // Обновление access token через refresh token
  Future<bool> refreshAccessToken() async {
    if (_refreshToken == null) {
      print('⚠️ Refresh token отсутствует');
      return false;
    }

    try {
      final response = await http.post(
        Uri.parse(ApiService.tokenRefreshUrl),
        headers: {
          'Content-Type': 'application/json',
        },
        body: jsonEncode({
          'refresh': _refreshToken,
        }),
      );

      print('📡 Refresh token response: ${response.statusCode}');

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        final newAccessToken = data['access'];

        if (newAccessToken != null) {
          await _storage.write(key: 'token', value: newAccessToken);
          _token = newAccessToken;
          notifyListeners();
          print('✅ Access token успешно обновлён');
          return true;
        }
      } else {
        print('❌ Не удалось обновить токен: ${response.statusCode}');
        // Refresh token истёк - очищаем данные и требуем повторный вход
        await clearAuthData();
      }
    } catch (e) {
      print('❌ Ошибка обновления токена: $e');
    }
    return false;
  }

  // Получение профиля пользователя
  Future<Map<String, dynamic>?> getUserProfile() async {
    if (_token == null) return null;

    try {
      final response = await http.get(
        Uri.parse(ApiService.profileUrl),
        headers: {
          'Authorization': 'Bearer $_token',
          'Content-Type': 'application/json',
        },
      );

      if (response.statusCode == 200) {
        return jsonDecode(response.body);
      } else if (response.statusCode == 401) {
        // Токен истёк, пробуем обновить
        final refreshed = await refreshAccessToken();
        if (refreshed) {
          // Повторяем запрос с новым токеном
          return await getUserProfile();
        }
      }
    } catch (e) {
      print('Ошибка получения профиля: $e');
    }
    return null;
  }
}
