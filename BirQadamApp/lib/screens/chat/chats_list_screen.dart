// lib/screens/chats_list_screen.dart

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import 'dart:async';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_slidable/flutter_slidable.dart';
import '../../providers/chat_provider.dart';
import '../../models/chat.dart';
import 'chat_detail_screen.dart';
import '../../widgets/common/skeleton_loader.dart';
import '../../widgets/common/empty_state.dart';
import '../../widgets/specialized/pull_to_refresh.dart';
import '../error/error_screen.dart';

class ChatsListScreen extends StatefulWidget {
  const ChatsListScreen({Key? key}) : super(key: key);

  @override
  State<ChatsListScreen> createState() => _ChatsListScreenState();
}

class _ChatsListScreenState extends State<ChatsListScreen> with SingleTickerProviderStateMixin {
  late AnimationController _animationController;
  StreamSubscription<RemoteMessage>? _fcmSubscription;
  Timer? _refreshTimer;
  
  @override
  void initState() {
    super.initState();
    _animationController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 300),
    );
    _animationController.forward();
    
    // Загружаем чаты при первом открытии
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<ChatProvider>().loadChats();
    });
    
    // Слушаем FCM сообщения для обновления списка чатов
    _fcmSubscription = FirebaseMessaging.onMessage.listen((RemoteMessage message) {
      print('💬 FCM message received in chat list: ${message.data}');
      
      // Обновляем список чатов при любом новом сообщении
      if (message.data['type'] == 'chat_message' && mounted) {
        print('💬 Updating chat list...');
        context.read<ChatProvider>().loadChats();
      }
    });
    
    // Автообновление списка чатов каждые 5 секунд (чтобы избежать 429 ошибки)
    _refreshTimer = Timer.periodic(const Duration(seconds: 5), (timer) {
      if (mounted) {
        context.read<ChatProvider>().loadChats();
      }
    });
  }

  @override
  void dispose() {
    _refreshTimer?.cancel();
    _fcmSubscription?.cancel();
    _animationController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Theme.of(context).brightness == Brightness.dark
          ? const Color(0xFF121212)
          : const Color(0xFFF5F5F5),
      appBar: AppBar(
        title: const Text(
          '💬 Чаты',
          style: TextStyle(
            fontWeight: FontWeight.bold,
            fontSize: 24,
          ),
        ),
        backgroundColor: Theme.of(context).brightness == Brightness.dark
            ? const Color(0xFF1E1E1E)
            : Colors.white,
        elevation: 0,
        actions: [
          // Иконка поиска (будет реализована позже)
          IconButton(
            icon: const Icon(Icons.search_rounded),
            onPressed: () {
              // TODO: Реализовать поиск по чатам
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(
                  content: Text('Поиск скоро будет доступен'),
                  duration: Duration(seconds: 1),
                ),
              );
            },
          ),
        ],
      ),
      body: Consumer<ChatProvider>(
        builder: (context, chatProvider, child) {
          if (chatProvider.isLoading && chatProvider.chats.isEmpty) {
            return _buildLoadingSkeleton();
          }

          if (chatProvider.error != null && chatProvider.chats.isEmpty) {
            // Проверяем, это ошибка сети или другая ошибка
            final error = chatProvider.error!.toLowerCase();
            if (error.contains('подключения') || 
                error.contains('connection') || 
                error.contains('network') || 
                error.contains('socketexception') ||
                error.contains('clientexception') ||
                error.contains('unreachable') ||
                error.contains('timed out') ||
                error.contains('failed host lookup')) {
              // Показываем экран ошибки сети через полноэкранный виджет
              return Center(
                child: ErrorScreens.noInternet(
                  onRetry: () => chatProvider.loadChats(),
                  onClose: () {},
                ),
              );
            } else {
              // Другие ошибки показываем через стандартный виджет
              return _buildErrorState(error, () {
                chatProvider.loadChats();
              });
            }
          }

          if (chatProvider.chats.isEmpty) {
            return _buildEmptyState();
          }

          return AppPullToRefresh(
            onRefresh: () => chatProvider.refresh(),
            child: ListView.builder(
              padding: const EdgeInsets.symmetric(vertical: 8),
              itemCount: chatProvider.chats.length,
              itemBuilder: (context, index) {
                final chat = chatProvider.chats[index];
                return _buildChatListItem(context, chat, index);
              },
            ),
          );
        },
      ),
    );
  }

  Widget _buildChatListItem(BuildContext context, ChatModel chat, int index) {
    
    return FadeTransition(
      opacity: CurvedAnimation(
        parent: _animationController,
        curve: Interval(
          (1 / 10) * index,
          1.0,
          curve: Curves.easeOut,
        ),
      ),
      child: SlideTransition(
        position: Tween<Offset>(
          begin: const Offset(1, 0),
          end: Offset.zero,
        ).animate(CurvedAnimation(
          parent: _animationController,
          curve: Interval(
            (1 / 10) * index,
            1.0,
            curve: Curves.easeOut,
          ),
        )),
        child: Slidable(
          key: Key('chat_${chat.id}'),
          endActionPane: ActionPane(
            motion: const StretchMotion(),
            extentRatio: 0.25,
            children: [
              SlidableAction(
                onPressed: (_) async {
                  // Переключаем уведомления
                  final chatProvider = context.read<ChatProvider>();
                  final settings = await chatProvider.getChatSettings(chat.id);
                  final newValue = !(settings?.notificationsEnabled ?? true);
                  
                  final success = await chatProvider.toggleNotifications(chat.id, newValue);
                  if (success && context.mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(
                        content: Text(newValue 
                            ? 'Уведомления включены' 
                            : 'Уведомления выключены'),
                        duration: const Duration(seconds: 2),
                        backgroundColor: const Color(0xFF4CAF50),
                      ),
                    );
                  }
                },
                backgroundColor: Colors.orange,
                foregroundColor: Colors.white,
                icon: Icons.notifications_off,
                label: 'Откл.',
                borderRadius: BorderRadius.circular(12),
              ),
            ],
          ),
          child: Container(
            margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
            decoration: BoxDecoration(
              color: Theme.of(context).brightness == Brightness.dark
                  ? const Color(0xFF1E1E1E)
                  : Colors.white,
              borderRadius: BorderRadius.circular(16),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.05),
                  blurRadius: 8,
                  offset: const Offset(0, 2),
                ),
              ],
            ),
            child: Material(
            color: Colors.transparent,
            borderRadius: BorderRadius.circular(16),
            child: InkWell(
              borderRadius: BorderRadius.circular(16),
              onTap: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (context) => ChatDetailScreen(chatId: chat.id),
                  ),
                );
              },
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: Row(
                  children: [
                    // Avatar
                    _buildAvatar(chat),
                    const SizedBox(width: 12),
                    
                    // Chat info
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Expanded(
                                child: Text(
                                  chat.name,
                                  style: const TextStyle(
                                    fontSize: 16,
                                    fontWeight: FontWeight.w600,
                                  ),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                              if (chat.lastMessage != null)
                                Text(
                                  _formatTime(chat.lastMessage!.timestamp),
                                  style: TextStyle(
                                    fontSize: 12,
                                    color: chat.unreadCount > 0
                                        ? const Color(0xFF4CAF50)
                                        : Colors.grey[600],
                                    fontWeight: chat.unreadCount > 0
                                        ? FontWeight.w600
                                        : FontWeight.normal,
                                  ),
                                ),
                            ],
                          ),
                          const SizedBox(height: 4),
                          Row(
                            children: [
                              Expanded(
                                child: _buildLastMessage(chat),
                              ),
                              if (chat.unreadCount > 0)
                                Container(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 8,
                                    vertical: 4,
                                  ),
                                  decoration: BoxDecoration(
                                    gradient: const LinearGradient(
                                      colors: [Color(0xFF4CAF50), Color(0xFF81C784)],
                                    ),
                                    borderRadius: BorderRadius.circular(12),
                                    boxShadow: [
                                      BoxShadow(
                                        color: const Color(0xFF4CAF50).withValues(alpha: 0.3),
                                        blurRadius: 4,
                                        offset: const Offset(0, 2),
                                      ),
                                    ],
                                  ),
                                  child: Text(
                                    chat.unreadCount > 99 ? '99+' : '${chat.unreadCount}',
                                    style: const TextStyle(
                                      color: Colors.white,
                                      fontSize: 11,
                                      fontWeight: FontWeight.bold,
                                    ),
                                  ),
                                ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
        ),
      ),
    );
  }

  Widget _buildAvatar(ChatModel chat) {
    return Hero(
      tag: 'chat_avatar_${chat.id}',
      child: Container(
        width: 56,
        height: 56,
        decoration: BoxDecoration(
          gradient: _getGradientForChat(chat.id),
          shape: BoxShape.circle,
          boxShadow: [
            BoxShadow(
              color: _getGradientForChat(chat.id).colors.first.withValues(alpha: 0.3),
              blurRadius: 8,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: Center(
          child: Text(
            chat.avatarInitials,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 20,
              fontWeight: FontWeight.bold,
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildLastMessage(ChatModel chat) {
    if (chat.lastMessage == null) {
      return Text(
        'Нет сообщений',
        style: TextStyle(
          fontSize: 14,
          color: Colors.grey[600],
          fontStyle: FontStyle.italic,
        ),
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
      );
    }

    final message = chat.lastMessage!;
    final prefix = message.sender?.isMe == true ? 'Вы: ' : '${message.sender?.name ?? ''}: ';
    
    return RichText(
      maxLines: 1,
      overflow: TextOverflow.ellipsis,
      text: TextSpan(
        style: TextStyle(
          fontSize: 14,
          color: chat.unreadCount > 0
              ? Theme.of(context).brightness == Brightness.dark
                  ? Colors.white
                  : Colors.black87
              : Colors.grey[600],
          fontWeight: chat.unreadCount > 0 ? FontWeight.w500 : FontWeight.normal,
        ),
        children: [
          if (!message.isMine)
            TextSpan(
              text: prefix,
              style: const TextStyle(fontWeight: FontWeight.w600),
            ),
          TextSpan(text: message.text),
        ],
      ),
    );
  }

  LinearGradient _getGradientForChat(int chatId) {
    // Генерируем уникальный градиент на основе ID чата
    final gradients = [
      const LinearGradient(colors: [Color(0xFF1976D2), Color(0xFF42A5F5)]),
      const LinearGradient(colors: [Color(0xFF4CAF50), Color(0xFF81C784)]),
      const LinearGradient(colors: [Color(0xFFFF9800), Color(0xFFFFB74D)]),
      const LinearGradient(colors: [Color(0xFF9C27B0), Color(0xFFBA68C8)]),
      const LinearGradient(colors: [Color(0xFFF44336), Color(0xFFE57373)]),
      const LinearGradient(colors: [Color(0xFF00BCD4), Color(0xFF4DD0E1)]),
    ];
    
    return gradients[chatId % gradients.length];
  }

  String _formatTime(DateTime timestamp) {
    final now = DateTime.now();
    final difference = now.difference(timestamp);

    if (difference.inDays == 0) {
      // Сегодня - показываем время
      return DateFormat('HH:mm').format(timestamp);
    } else if (difference.inDays == 1) {
      // Вчера
      return 'Вчера';
    } else if (difference.inDays < 7) {
      // Меньше недели - показываем день недели
      return DateFormat('EEEE', 'ru').format(timestamp);
    } else {
      // Больше недели - показываем дату
      return DateFormat('dd.MM.yy').format(timestamp);
    }
  }

  Widget _buildLoadingSkeleton() {
    return ListView.builder(
      padding: const EdgeInsets.all(12),
      itemCount: 8,
      itemBuilder: (context, index) {
        return Container(
          margin: const EdgeInsets.only(bottom: 12),
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
          ),
          child: Row(
            children: [
              const SkeletonLoader(
                width: 56,
                height: 56,
                borderRadius: 28,
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    SkeletonLoader(
                      width: double.infinity,
                      height: 16,
                      borderRadius: 4,
                    ),
                    const SizedBox(height: 8),
                    SkeletonLoader(
                      width: MediaQuery.of(context).size.width * 0.6,
                      height: 14,
                      borderRadius: 4,
                    ),
                  ],
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: EmptyState(
        icon: Icons.chat_bubble_outline_rounded,
        title: 'Нет чатов',
        message: 'Присоединитесь к проекту,\nчтобы начать общаться',
      ),
    );
  }

  Widget _buildErrorState(String error, VoidCallback onRetry) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              Icons.error_outline_rounded,
              size: 64,
              color: Colors.grey[400],
            ),
            const SizedBox(height: 16),
            Text(
              'Ошибка загрузки',
              style: TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.bold,
                color: Colors.grey[700],
              ),
            ),
            const SizedBox(height: 8),
            Text(
              error,
              style: TextStyle(
                fontSize: 14,
                color: Colors.grey[600],
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 24),
            ElevatedButton.icon(
              onPressed: onRetry,
              icon: const Icon(Icons.refresh),
              label: const Text('Повторить'),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF4CAF50),
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

