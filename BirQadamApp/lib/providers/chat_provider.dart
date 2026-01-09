// lib/providers/chat_provider.dart

import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';
import 'dart:io';
import '../models/chat.dart';
import '../config/app_config.dart';

class ChatProvider with ChangeNotifier {
  final String? _token;
  
  List<ChatModel> _chats = [];
  bool _isLoading = false;
  String? _error;

  ChatProvider(this._token);

  List<ChatModel> get chats => _chats;
  bool get isLoading => _isLoading;
  String? get error => _error;
  int get unreadMessagesCount => _chats.fold(0, (sum, chat) => sum + chat.unreadCount);

  /// Загрузить список чатов
  Future<void> loadChats() async {
    print('💬 ChatProvider: loadChats() called');
    print('💬 Token: ${_token != null ? "EXISTS (${_token!.substring(0, 20)}...)" : "NULL"}');
    
    if (_token == null) {
      print('❌ ChatProvider: Token is null, cannot load chats');
      _error = 'Не авторизован';
      notifyListeners();
      return;
    }

    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final url = '${AppConfig.apiBaseUrl}/custom-admin/api/v1/chats/';
      print('💬 ChatProvider: Requesting $url');
      
      final response = await http.get(
        Uri.parse(url),
        headers: {
          'Authorization': 'Bearer $_token',
          'Content-Type': 'application/json',
        },
      );

      print('💬 ChatProvider: Response status: ${response.statusCode}');
      print('💬 ChatProvider: Response body: ${response.body}');

      if (response.statusCode == 200) {
        final data = jsonDecode(utf8.decode(response.bodyBytes));
        _chats = (data['chats'] as List)
            .map((chat) => ChatModel.fromJson(chat))
            .toList();
        _error = null;
        print('✅ ChatProvider: Loaded ${_chats.length} chats');
      } else {
        _error = 'Ошибка загрузки чатов (${response.statusCode})';
        print('❌ ChatProvider: Error ${response.statusCode}: ${response.body}');
      }
    } catch (e) {
      _error = 'Ошибка подключения: $e';
      print('❌ ChatProvider: Exception: $e');
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  /// Получить сообщения конкретного чата
  Future<List<ChatMessage>> getChatMessages(int chatId, {int offset = 0, int limit = 50}) async {
    print('💬 getChatMessages: chatId=$chatId, token=${_token != null ? "EXISTS" : "NULL"}');
    
    if (_token == null) {
      print('❌ getChatMessages: Token is null');
      return [];
    }

    try {
      final url = '${AppConfig.apiBaseUrl}/custom-admin/api/v1/chats/$chatId/messages/?offset=$offset&limit=$limit';
      print('💬 getChatMessages: Requesting $url');
      
      final response = await http.get(
        Uri.parse(url),
        headers: {
          'Authorization': 'Bearer $_token',
          'Content-Type': 'application/json',
        },
      );

      print('💬 getChatMessages: Response status: ${response.statusCode}');
      print('💬 getChatMessages: Response body: ${response.body}');

      if (response.statusCode == 200) {
        final data = jsonDecode(utf8.decode(response.bodyBytes));
        final messages = (data['messages'] as List)
            .map((msg) => ChatMessage.fromJson(msg))
            .toList();
        
        print('✅ getChatMessages: Loaded ${messages.length} messages');
        
        // Обновляем счетчик непрочитанных для этого чата
        final chatIndex = _chats.indexWhere((c) => c.id == chatId);
        if (chatIndex != -1) {
          _chats[chatIndex] = ChatModel(
            id: _chats[chatIndex].id,
            name: _chats[chatIndex].name,
            avatarInitials: _chats[chatIndex].avatarInitials,
            chatType: _chats[chatIndex].chatType,
            projectId: _chats[chatIndex].projectId,
            lastMessage: _chats[chatIndex].lastMessage,
            unreadCount: 0, // Все прочитано
            participantCount: _chats[chatIndex].participantCount,
            createdAt: _chats[chatIndex].createdAt,
          );
          notifyListeners();
        }
        
        return messages;
      } else {
        print('❌ getChatMessages: Failed with status ${response.statusCode}');
        print('❌ getChatMessages: Response: ${response.body}');
        throw Exception('Failed to load messages (${response.statusCode})');
      }
    } catch (e) {
      print('❌ getChatMessages: Exception: $e');
      rethrow;
    }
  }

  /// Отправить текстовое сообщение
  Future<ChatMessage?> sendMessage(int chatId, String text) async {
    if (_token == null) return null;

    try {
      final response = await http.post(
        Uri.parse('${AppConfig.apiBaseUrl}/custom-admin/api/v1/chats/$chatId/messages/'),
        headers: {
          'Authorization': 'Bearer $_token',
          'Content-Type': 'application/json',
        },
        body: jsonEncode({
          'text': text,
        }),
      );

      if (response.statusCode == 201) {
        final data = jsonDecode(utf8.decode(response.bodyBytes));
        final message = ChatMessage.fromJson(data['message']);
        
        print('✅ Message sent successfully');
        
        // Обновляем список чатов в фоне (без ожидания)
        loadChats();
        
        return message;
      } else {
        print('❌ Failed to send message: ${response.statusCode}');
        throw Exception('Failed to send message');
      }
    } catch (e) {
      print('Error sending message: $e');
      return null;
    }
  }
  
  /// Отправить сообщение с медиа (изображение или видео)
  Future<bool> sendMediaMessage(int chatId, File file, String mediaType, {String? caption}) async {
    if (_token == null) return false;

    try {
      var request = http.MultipartRequest(
        'POST',
        Uri.parse('${AppConfig.apiBaseUrl}/custom-admin/api/v1/chats/$chatId/messages/'),
      );
      
      request.headers['Authorization'] = 'Bearer $_token';
      
      // Добавляем текст (подпись), если есть
      if (caption != null && caption.isNotEmpty) {
        request.fields['text'] = caption;
      }
      
      // Добавляем файл
      final multipartFile = await http.MultipartFile.fromPath(
        mediaType == 'image' ? 'image' : 'video',
        file.path,
      );
      request.files.add(multipartFile);
      
      print('📤 Sending $mediaType message to chat $chatId');
      
      final streamedResponse = await request.send();
      final response = await http.Response.fromStream(streamedResponse);
      
      if (response.statusCode == 201) {
        print('✅ Media message sent successfully');
        
        // Обновляем список чатов в фоне (без ожидания)
        loadChats();
        
        return true;
      } else {
        print('❌ Failed to send media message: ${response.statusCode}');
        print('Response: ${response.body}');
        return false;
      }
    } catch (e) {
      print('Error sending media message: $e');
      return false;
    }
  }

  /// Отметить чат как прочитанный
  Future<void> markChatAsRead(int chatId) async {
    if (_token == null) return;

    try {
      await http.post(
        Uri.parse('${AppConfig.apiBaseUrl}/custom-admin/api/v1/chats/$chatId/read/'),
        headers: {
          'Authorization': 'Bearer $_token',
          'Content-Type': 'application/json',
        },
      );

      // Обновляем локально
      final chatIndex = _chats.indexWhere((c) => c.id == chatId);
      if (chatIndex != -1) {
        _chats[chatIndex] = ChatModel(
          id: _chats[chatIndex].id,
          name: _chats[chatIndex].name,
          avatarInitials: _chats[chatIndex].avatarInitials,
          chatType: _chats[chatIndex].chatType,
          projectId: _chats[chatIndex].projectId,
          lastMessage: _chats[chatIndex].lastMessage,
          unreadCount: 0,
          participantCount: _chats[chatIndex].participantCount,
          createdAt: _chats[chatIndex].createdAt,
        );
        notifyListeners();
      }
    } catch (e) {
      print('Error marking chat as read: $e');
    }
  }

  /// Получить чат по ID
  ChatModel? getChatById(int chatId) {
    try {
      return _chats.firstWhere((chat) => chat.id == chatId);
    } catch (e) {
      return null;
    }
  }

  /// Обновить данные
  Future<void> refresh() async {
    await loadChats();
  }

  // ==================== ADVANCED FEATURES ====================

  /// Установить статус печати (typing indicator)
  Future<void> setTypingStatus(int chatId, String typingType) async {
    if (_token == null) return;

    try {
      await http.post(
        Uri.parse('${AppConfig.apiBaseUrl}/custom-admin/api/v1/chats/$chatId/typing/'),
        headers: {
          'Authorization': 'Bearer $_token',
          'Content-Type': 'application/json',
        },
        body: jsonEncode({'typing_type': typingType}),
      );
    } catch (e) {
      print('Error setting typing status: $e');
    }
  }

  /// Получить активные статусы печати в чате
  Future<List<TypingUser>> getTypingUsers(int chatId) async {
    if (_token == null) return [];

    try {
      final response = await http.get(
        Uri.parse('${AppConfig.apiBaseUrl}/custom-admin/api/v1/chats/$chatId/typing/'),
        headers: {
          'Authorization': 'Bearer $_token',
          'Content-Type': 'application/json',
        },
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(utf8.decode(response.bodyBytes));
        return (data['typing_users'] as List)
            .map((user) => TypingUser.fromJson(user))
            .toList();
      }
    } catch (e) {
      print('Error getting typing users: $e');
    }
    return [];
  }

  /// Закрепить сообщение
  Future<bool> pinMessage(int chatId, int messageId) async {
    if (_token == null) return false;

    try {
      final response = await http.post(
        Uri.parse('${AppConfig.apiBaseUrl}/custom-admin/api/v1/chats/$chatId/messages/$messageId/pin/'),
        headers: {
          'Authorization': 'Bearer $_token',
          'Content-Type': 'application/json',
        },
      );

      return response.statusCode == 201 || response.statusCode == 200;
    } catch (e) {
      print('Error pinning message: $e');
      return false;
    }
  }

  /// Открепить сообщение
  Future<bool> unpinMessage(int chatId, int messageId) async {
    if (_token == null) return false;

    try {
      final response = await http.delete(
        Uri.parse('${AppConfig.apiBaseUrl}/custom-admin/api/v1/chats/$chatId/messages/$messageId/pin/'),
        headers: {
          'Authorization': 'Bearer $_token',
          'Content-Type': 'application/json',
        },
      );

      return response.statusCode == 200;
    } catch (e) {
      print('Error unpinning message: $e');
      return false;
    }
  }

  /// Получить закрепленные сообщения
  Future<List<PinnedMessage>> getPinnedMessages(int chatId) async {
    if (_token == null) return [];

    try {
      final response = await http.get(
        Uri.parse('${AppConfig.apiBaseUrl}/custom-admin/api/v1/chats/$chatId/pinned/'),
        headers: {
          'Authorization': 'Bearer $_token',
          'Content-Type': 'application/json',
        },
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(utf8.decode(response.bodyBytes));
        return (data['pinned_messages'] as List)
            .map((msg) => PinnedMessage.fromJson(msg))
            .toList();
      }
    } catch (e) {
      print('Error getting pinned messages: $e');
    }
    return [];
  }

  /// Получить настройки чата
  Future<ChatSettings?> getChatSettings(int chatId) async {
    if (_token == null) return null;

    try {
      final response = await http.get(
        Uri.parse('${AppConfig.apiBaseUrl}/custom-admin/api/v1/chats/$chatId/settings/'),
        headers: {
          'Authorization': 'Bearer $_token',
          'Content-Type': 'application/json',
        },
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(utf8.decode(response.bodyBytes));
        return ChatSettings.fromJson(data);
      }
    } catch (e) {
      print('Error getting chat settings: $e');
    }
    return null;
  }

  /// Переключить уведомления для чата
  Future<bool> toggleNotifications(int chatId, bool enabled) async {
    if (_token == null) return false;

    try {
      final response = await http.put(
        Uri.parse('${AppConfig.apiBaseUrl}/custom-admin/api/v1/chats/$chatId/settings/'),
        headers: {
          'Authorization': 'Bearer $_token',
          'Content-Type': 'application/json',
        },
        body: jsonEncode({'notifications_enabled': enabled}),
      );

      if (response.statusCode == 200) {
        // Можно добавить локальное уведомление
        return true;
      }
    } catch (e) {
      print('Error toggling notifications: $e');
    }
    return false;
  }

  /// Отметить сообщения как доставленные
  Future<void> markMessagesAsDelivered(int chatId, List<int> messageIds) async {
    if (_token == null || messageIds.isEmpty) return;

    try {
      await http.post(
        Uri.parse('${AppConfig.apiBaseUrl}/custom-admin/api/v1/chats/$chatId/delivered/'),
        headers: {
          'Authorization': 'Bearer $_token',
          'Content-Type': 'application/json',
        },
        body: jsonEncode({'message_ids': messageIds}),
      );
    } catch (e) {
      print('Error marking messages as delivered: $e');
    }
  }
}

