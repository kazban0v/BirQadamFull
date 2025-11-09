// lib/models/chat.dart

class ChatModel {
  final int id;
  final String name;
  final String avatarInitials;
  final String chatType;
  final int? projectId;
  final ChatMessage? lastMessage;
  final int unreadCount;
  final int participantCount;
  final DateTime createdAt;

  ChatModel({
    required this.id,
    required this.name,
    required this.avatarInitials,
    required this.chatType,
    this.projectId,
    this.lastMessage,
    required this.unreadCount,
    required this.participantCount,
    required this.createdAt,
  });

  factory ChatModel.fromJson(Map<String, dynamic> json) {
    return ChatModel(
      id: json['id'],
      name: json['name'] ?? '',
      avatarInitials: json['avatar_initials'] ?? '',
      chatType: json['chat_type'] ?? 'project',
      projectId: json['project_id'],
      lastMessage: json['last_message'] != null
          ? ChatMessage.fromJson(json['last_message'])
          : null,
      unreadCount: json['unread_count'] ?? 0,
      participantCount: json['participant_count'] ?? 0,
      createdAt: DateTime.parse(json['created_at']),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'avatar_initials': avatarInitials,
      'chat_type': chatType,
      'project_id': projectId,
      'last_message': lastMessage?.toJson(),
      'unread_count': unreadCount,
      'participant_count': participantCount,
      'created_at': createdAt.toIso8601String(),
    };
  }
}

class ChatMessage {
  final int? id;
  final String text;
  final MessageSender? sender;
  final String messageType;
  final String? imageUrl;
  final String? fileUrl;  // Для видео и других файлов
  final bool isRead;
  final bool isDelivered;  // NEW: Статус доставки
  final DateTime? readAt;  // NEW: Время прочтения
  final DateTime? deliveredAt;  // NEW: Время доставки
  final DateTime timestamp;

  ChatMessage({
    this.id,
    required this.text,
    this.sender,
    this.messageType = 'text',
    this.imageUrl,
    this.fileUrl,
    this.isRead = false,
    this.isDelivered = false,
    this.readAt,
    this.deliveredAt,
    required this.timestamp,
  });

  factory ChatMessage.fromJson(Map<String, dynamic> json) {
    return ChatMessage(
      id: json['id'],
      text: json['text'] ?? '',
      sender: json['sender'] != null
          ? MessageSender.fromJson(json['sender'])
          : MessageSender.fromJson(json), // Для last_message в списке чатов
      messageType: json['message_type'] ?? 'text',
      imageUrl: json['image'],
      fileUrl: json['file'],
      isRead: json['is_read'] ?? false,
      isDelivered: json['is_delivered'] ?? false,
      readAt: json['read_at'] != null ? DateTime.parse(json['read_at']) : null,
      deliveredAt: json['delivered_at'] != null ? DateTime.parse(json['delivered_at']) : null,
      timestamp: DateTime.parse(json['timestamp']),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'text': text,
      'sender': sender?.toJson(),
      'message_type': messageType,
      'image': imageUrl,
      'file': fileUrl,
      'is_read': isRead,
      'is_delivered': isDelivered,
      'read_at': readAt?.toIso8601String(),
      'delivered_at': deliveredAt?.toIso8601String(),
      'timestamp': timestamp.toIso8601String(),
    };
  }

  bool get isMine => sender?.isMe ?? false;
  bool get hasMedia => imageUrl != null || fileUrl != null;
  bool get isImage => messageType == 'image';
  bool get isVideo => messageType == 'video';
  bool get isDeliveredButNotRead => isDelivered && !isRead;  // NEW: Helper
}

class MessageSender {
  final int id;
  final String name;
  final bool isMe;

  MessageSender({
    required this.id,
    required this.name,
    required this.isMe,
  });

  factory MessageSender.fromJson(Map<String, dynamic> json) {
    return MessageSender(
      id: json['id'] ?? 0,
      name: json['sender_name'] ?? json['name'] ?? 'Пользователь',
      isMe: json['is_mine'] ?? json['is_me'] ?? false,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'is_me': isMe,
    };
  }
}

// NEW: Статус печати пользователя
class TypingUser {
  final int userId;
  final String userName;
  final String typingType;
  final DateTime startedAt;

  TypingUser({
    required this.userId,
    required this.userName,
    required this.typingType,
    required this.startedAt,
  });

  factory TypingUser.fromJson(Map<String, dynamic> json) {
    return TypingUser(
      userId: json['user_id'],
      userName: json['user_name'],
      typingType: json['typing_type'],
      startedAt: DateTime.parse(json['started_at']),
    );
  }

  String get displayText {
    switch (typingType) {
      case 'image':
        return 'отправляет фото...';
      case 'video':
        return 'отправляет видео...';
      case 'file':
        return 'отправляет файл...';
      default:
        return 'печатает...';
    }
  }
}

// NEW: Закрепленное сообщение
class PinnedMessage {
  final int id;
  final ChatMessage message;
  final int pinnedById;
  final String pinnedByName;
  final DateTime pinnedAt;

  PinnedMessage({
    required this.id,
    required this.message,
    required this.pinnedById,
    required this.pinnedByName,
    required this.pinnedAt,
  });

  factory PinnedMessage.fromJson(Map<String, dynamic> json) {
    return PinnedMessage(
      id: json['id'],
      message: ChatMessage.fromJson(json['message']),
      pinnedById: json['pinned_by']['id'],
      pinnedByName: json['pinned_by']['name'],
      pinnedAt: DateTime.parse(json['pinned_at']),
    );
  }
}

// NEW: Настройки чата
class ChatSettings {
  final bool notificationsEnabled;
  final DateTime joinedAt;
  final DateTime lastReadAt;

  ChatSettings({
    required this.notificationsEnabled,
    required this.joinedAt,
    required this.lastReadAt,
  });

  factory ChatSettings.fromJson(Map<String, dynamic> json) {
    return ChatSettings(
      notificationsEnabled: json['notifications_enabled'] ?? true,
      joinedAt: DateTime.parse(json['joined_at']),
      lastReadAt: DateTime.parse(json['last_read_at']),
    );
  }
}

