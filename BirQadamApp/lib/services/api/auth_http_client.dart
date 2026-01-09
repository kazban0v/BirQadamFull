import 'package:http/http.dart' as http;
import 'dart:convert';
import '../../providers/auth_provider.dart';
import 'package:flutter/foundation.dart';

/// HTTP Client с автоматическим обновлением токена при 401
/// 
/// Этот класс оборачивает стандартные HTTP запросы и автоматически
/// обрабатывает истечение JWT токена (401 Unauthorized).
/// При получении 401, клиент пытается обновить токен через refresh token
/// и повторяет запрос с новым access token.
class AuthHttpClient {
  final AuthProvider authProvider;

  AuthHttpClient(this.authProvider);

  /// GET запрос с автоматическим retry при 401
  Future<http.Response> get(
    Uri url, {
    Map<String, String>? headers,
  }) async {
    return _makeRequest(
      () => http.get(url, headers: _buildHeaders(headers)),
      () => http.get(url, headers: _buildHeaders(headers)),
    );
  }

  /// POST запрос с автоматическим retry при 401
  Future<http.Response> post(
    Uri url, {
    Map<String, String>? headers,
    Object? body,
  }) async {
    return _makeRequest(
      () => http.post(url, headers: _buildHeaders(headers), body: body),
      () => http.post(url, headers: _buildHeaders(headers), body: body),
    );
  }

  /// PUT запрос с автоматическим retry при 401
  Future<http.Response> put(
    Uri url, {
    Map<String, String>? headers,
    Object? body,
  }) async {
    return _makeRequest(
      () => http.put(url, headers: _buildHeaders(headers), body: body),
      () => http.put(url, headers: _buildHeaders(headers), body: body),
    );
  }

  /// DELETE запрос с автоматическим retry при 401
  Future<http.Response> delete(
    Uri url, {
    Map<String, String>? headers,
  }) async {
    return _makeRequest(
      () => http.delete(url, headers: _buildHeaders(headers)),
      () => http.delete(url, headers: _buildHeaders(headers)),
    );
  }

  /// PATCH запрос с автоматическим retry при 401
  Future<http.Response> patch(
    Uri url, {
    Map<String, String>? headers,
    Object? body,
  }) async {
    return _makeRequest(
      () => http.patch(url, headers: _buildHeaders(headers), body: body),
      () => http.patch(url, headers: _buildHeaders(headers), body: body),
    );
  }

  /// Построение headers с автоматическим добавлением Authorization
  Map<String, String> _buildHeaders(Map<String, String>? headers) {
    final finalHeaders = headers ?? {};
    
    // Добавляем Authorization header если есть токен
    if (authProvider.token != null && authProvider.token!.isNotEmpty) {
      finalHeaders['Authorization'] = 'Bearer ${authProvider.token}';
    }
    
    // Добавляем Content-Type если не указан
    if (!finalHeaders.containsKey('Content-Type')) {
      finalHeaders['Content-Type'] = 'application/json';
    }
    
    return finalHeaders;
  }

  /// Универсальный метод для выполнения запроса с retry при 401
  Future<http.Response> _makeRequest(
    Future<http.Response> Function() request,
    Future<http.Response> Function() retryRequest,
  ) async {
    try {
      // Первая попытка
      var response = await request();

      // Если 401 - пытаемся обновить токен
      if (response.statusCode == 401) {
        if (kDebugMode) {
          print('🔄 Token expired (401), attempting refresh...');
        }

        final refreshed = await authProvider.refreshAccessToken();

        if (refreshed) {
          if (kDebugMode) {
            print('✅ Token refreshed successfully, retrying request...');
          }
          
          // Повторяем запрос с новым токеном
          response = await retryRequest();
          
          if (kDebugMode) {
            print('📡 Retry response status: ${response.statusCode}');
          }
        } else {
          if (kDebugMode) {
            print('❌ Token refresh failed, logging out...');
          }
          
          // Токен не удалось обновить - выходим из аккаунта
          await authProvider.logout();
          
          throw Exception('Session expired. Please login again.');
        }
      }

      return response;
    } catch (e) {
      if (kDebugMode) {
        print('❌ Request error: $e');
      }
      rethrow;
    }
  }

  /// Вспомогательный метод для декодирования JSON ответа
  static Map<String, dynamic>? decodeResponse(http.Response response) {
    try {
      if (response.body.isNotEmpty) {
        return jsonDecode(response.body) as Map<String, dynamic>;
      }
      return null;
    } catch (e) {
      if (kDebugMode) {
        print('❌ Failed to decode JSON: $e');
      }
      return null;
    }
  }

  /// Проверка успешности ответа (2xx)
  static bool isSuccess(http.Response response) {
    return response.statusCode >= 200 && response.statusCode < 300;
  }
}


