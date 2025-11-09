// lib/screens/chat_detail_screen.dart

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import 'dart:async';
import 'dart:io';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:image_picker/image_picker.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter_slidable/flutter_slidable.dart';
import '../../providers/chat_provider.dart';
import '../../models/chat.dart';
import '../../config/app_config.dart';
import '../../widgets/media/video_player_widget.dart';
import '../error/error_screen.dart';
import 'package:permission_handler/permission_handler.dart';

class ChatDetailScreen extends StatefulWidget {
  final int chatId;

  const ChatDetailScreen({Key? key, required this.chatId}) : super(key: key);

  @override
  State<ChatDetailScreen> createState() => _ChatDetailScreenState();
}

class _ChatDetailScreenState extends State<ChatDetailScreen> with TickerProviderStateMixin {
  final TextEditingController _messageController = TextEditingController();
  final ScrollController _scrollController = ScrollController();
  final FocusNode _focusNode = FocusNode();
  final ImagePicker _picker = ImagePicker();
  
  List<ChatMessage> _messages = [];
  bool _isLoadingMessages = true;
  String? _messagesError; // Ошибка загрузки сообщений
  bool _isSending = false;
  bool _showMediaOptions = false;
  File? _selectedMedia;
  String? _mediaType; // 'image' or 'video'
  ChatModel? _chat;
  Timer? _refreshTimer;
  Timer? _typingTimer; // NEW: Таймер для typing indicator
  List<TypingUser> _typingUsers = []; // NEW: Пользователи, которые печатают
  List<PinnedMessage> _pinnedMessages = []; // NEW: Закрепленные сообщения
  StreamSubscription<RemoteMessage>? _fcmSubscription;
  
  late AnimationController _sendButtonController;
  late AnimationController _mediaOptionsController;

  @override
  void initState() {
    super.initState();
    _sendButtonController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 300),
    );
    _mediaOptionsController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 300),
    );
    
    _loadChat();
    _loadMessages(showLoading: true); // Первая загрузка с индикатором
    _loadPinnedMessages(); // NEW: Загружаем закрепленные сообщения
    _markAsRead();
    
    // Автообновление каждые 5 секунд (чтобы избежать 429 ошибки)
    _refreshTimer = Timer.periodic(const Duration(seconds: 5), (timer) {
      if (mounted) {
        _loadMessages(); // Автообновление без индикатора
        _loadTypingUsers(); // NEW: Загружаем typing users
      }
    });
    
    // Слушаем FCM сообщения для мгновенного обновления
    _fcmSubscription = FirebaseMessaging.onMessage.listen((RemoteMessage message) {
      print('💬 FCM message received in chat: ${message.data}');
      
      // Проверяем, что это сообщение для этого чата
      if (message.data['type'] == 'chat_message') {
        final messageChatId = int.tryParse(message.data['chat_id']?.toString() ?? '');
        
        if (messageChatId == widget.chatId && mounted) {
          print('💬 New message for current chat! Reloading...');
          // Сразу загружаем новые сообщения
          _loadMessages();
        }
      }
    });
  }

  void _loadChat() {
    final chatProvider = context.read<ChatProvider>();
    setState(() {
      _chat = chatProvider.getChatById(widget.chatId);
    });
  }

  Future<void> _loadMessages({bool showLoading = false}) async {
    if (showLoading && mounted) {
      setState(() {
        _isLoadingMessages = true;
        _messagesError = null;
      });
    }
    
    try {
      final chatProvider = context.read<ChatProvider>();
      final messages = await chatProvider.getChatMessages(widget.chatId);
      
      if (mounted) {
        // Проверяем, есть ли новые сообщения
        final hasNewMessages = messages.length > _messages.length;
        
        setState(() {
          _messages = messages;
          _isLoadingMessages = false;
          _messagesError = null;
        });
        
        // ВСЕГДА прокручиваем вниз после загрузки, если есть новые сообщения
        if (showLoading || hasNewMessages) {
          _scrollToBottom();
        }
      }
    } catch (e) {
      print('Error loading messages: $e');
      if (mounted) {
        setState(() {
          _isLoadingMessages = false;
          _messagesError = 'Ошибка загрузки сообщений: $e';
        });
      }
    }
  }

  Future<void> _markAsRead() async {
    final chatProvider = context.read<ChatProvider>();
    await chatProvider.markChatAsRead(widget.chatId);
  }

  void _scrollToBottom() {
    // Прокручиваем в самый низ списка
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollController.hasClients && mounted) {
        _scrollController.animateTo(
          _scrollController.position.maxScrollExtent,
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeOut,
        );
      }
    });
  }

  Future<void> _sendMessage() async {
    final text = _messageController.text.trim();
    if (text.isEmpty || _isSending) return;

    setState(() {
      _isSending = true;
    });

    _sendButtonController.forward();

    try {
      final chatProvider = context.read<ChatProvider>();
      final message = await chatProvider.sendMessage(widget.chatId, text);

      if (message != null && mounted) {
        _messageController.clear();
        
        // Сначала добавляем сообщение локально для мгновенного отображения
        setState(() {
          _messages.add(message);
        });
        
        // Сразу прокручиваем вниз
        _scrollToBottom();
        
        // Затем перезагружаем с сервера для синхронизации
        Future.delayed(const Duration(milliseconds: 500), () {
          if (mounted) {
            _loadMessages();
          }
        });
      }
    } catch (e) {
      print('Error sending message: $e');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Ошибка отправки: $e'),
            backgroundColor: Colors.red,
          ),
        );
      }
    } finally {
      if (mounted) {
        setState(() {
          _isSending = false;
        });
        _sendButtonController.reverse();
      }
    }
  }

  Future<void> _pickMedia(ImageSource source, String type) async {
    try {
      // Проверяем разрешение на камеру, если это камера
      if (source == ImageSource.camera) {
        final permission = await Permission.camera.status;
        if (permission.isDenied || permission.isPermanentlyDenied) {
          // Показываем экран ошибки доступа к камере
          if (mounted) {
            Navigator.push(
              context,
              MaterialPageRoute(
                builder: (_) => ErrorScreens.noCameraAccess(
                  onClose: () => Navigator.pop(context),
                ),
              ),
            );
          }
          return;
        }
      }
      
      final XFile? pickedFile;
      
      if (type == 'image') {
        pickedFile = await _picker.pickImage(
          source: source,
          maxWidth: 1920,
          maxHeight: 1920,
          imageQuality: 85,
        );
      } else {
        pickedFile = await _picker.pickVideo(
          source: source,
          maxDuration: const Duration(minutes: 5),
        );
      }

      if (pickedFile != null && mounted) {
        setState(() {
          _selectedMedia = File(pickedFile!.path);
          _mediaType = type;
          _showMediaOptions = false;
        });
        _mediaOptionsController.reverse();
      }
    } catch (e) {
      print('Error picking media: $e');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Ошибка выбора файла: $e'),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }

  Future<void> _sendMediaMessage() async {
    if (_selectedMedia == null || _mediaType == null || _isSending) return;

    setState(() {
      _isSending = true;
    });

    _sendButtonController.forward();

    try {
      // NEW: Отправляем статус "отправляет фото/видео"
      String typingType;
      if (_mediaType == 'image') {
        typingType = 'image';
      } else if (_mediaType == 'video') {
        typingType = 'video';
      } else {
        typingType = 'text'; // Fallback
      }
      print('🎬 Отправка статуса печати: $typingType (mediaType: $_mediaType)');
      _sendTypingStatus(typingType);
      
      final chatProvider = context.read<ChatProvider>();
      final caption = _messageController.text.trim();
      
      final success = await chatProvider.sendMediaMessage(
        widget.chatId,
        _selectedMedia!,
        _mediaType!,
        caption: caption.isNotEmpty ? caption : null,
      );

      if (success && mounted) {
        setState(() {
          _selectedMedia = null;
          _mediaType = null;
        });
        _messageController.clear();
        
        // Сразу загружаем новые сообщения
        await _loadMessages();
        _scrollToBottom();
      } else if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Ошибка отправки файла'),
            backgroundColor: Colors.red,
          ),
        );
      }
    } catch (e) {
      print('Error sending media: $e');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Ошибка отправки: $e'),
            backgroundColor: Colors.red,
          ),
        );
      }
    } finally {
      if (mounted) {
        setState(() {
          _isSending = false;
        });
        _sendButtonController.reverse();
      }
    }
  }

  void _toggleMediaOptions() {
    setState(() {
      _showMediaOptions = !_showMediaOptions;
      if (_showMediaOptions) {
        _mediaOptionsController.forward();
        _focusNode.unfocus();
      } else {
        _mediaOptionsController.reverse();
      }
    });
  }

  /// NEW: Отправить статус печати
  Future<void> _sendTypingStatus(String typingType) async {
    try {
      await context.read<ChatProvider>().setTypingStatus(widget.chatId, typingType);
    } catch (e) {
      print('Error sending typing status: $e');
    }
  }

  /// NEW: Загрузить пользователей, которые печатают
  Future<void> _loadTypingUsers() async {
    try {
      final typingUsers = await context.read<ChatProvider>().getTypingUsers(widget.chatId);
      if (mounted) {
        setState(() {
          _typingUsers = typingUsers;
        });
      }
    } catch (e) {
      print('Error loading typing users: $e');
    }
  }

  /// NEW: Загрузить закрепленные сообщения
  Future<void> _loadPinnedMessages() async {
    try {
      final pinnedMessages = await context.read<ChatProvider>().getPinnedMessages(widget.chatId);
      if (mounted) {
        setState(() {
          _pinnedMessages = pinnedMessages;
        });
      }
    } catch (e) {
      print('Error loading pinned messages: $e');
    }
  }

  /// NEW: Закрепить/открепить сообщение
  Future<void> _togglePin(ChatMessage message) async {
    if (message.id == null) return;

    try {
      // Проверяем, закреплено ли сообщение
      final isPinned = _pinnedMessages.any((pm) => pm.message.id == message.id);
      
      final success = isPinned
          ? await context.read<ChatProvider>().unpinMessage(widget.chatId, message.id!)
          : await context.read<ChatProvider>().pinMessage(widget.chatId, message.id!);

      if (success && mounted) {
        // Обновляем список закрепленных
        await _loadPinnedMessages();
        
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(isPinned ? 'Сообщение откреплено' : 'Сообщение закреплено'),
            duration: const Duration(seconds: 2),
            backgroundColor: const Color(0xFF4CAF50),
          ),
        );
      }
    } catch (e) {
      print('Error toggling pin: $e');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Ошибка при закреплении'),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }

  @override
  void dispose() {
    _refreshTimer?.cancel();
    _typingTimer?.cancel(); // NEW: Отменяем typing timer
    _fcmSubscription?.cancel();
    _messageController.dispose();
    _scrollController.dispose();
    _focusNode.dispose();
    _sendButtonController.dispose();
    _mediaOptionsController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Theme.of(context).brightness == Brightness.dark
          ? const Color(0xFF0D0D0D)
          : const Color(0xFFF0F0F0),
      appBar: _buildAppBar(),
      body: Column(
        children: [
          // NEW: Баннер закрепленных сообщений
          if (_pinnedMessages.isNotEmpty) _buildPinnedBanner(),
          
          // Сообщения
          Expanded(
            child: _isLoadingMessages
                ? _buildLoadingState()
                : (_messagesError != null && _messages.isEmpty
                    ? _buildErrorState()
                    : _buildMessagesList()),
          ),
          
          // NEW: Индикатор печати
          if (_typingUsers.isNotEmpty) _buildTypingIndicator(),
          
          // Поле ввода
          _buildMessageInput(),
        ],
      ),
    );
  }

  PreferredSizeWidget _buildAppBar() {
    return AppBar(
      backgroundColor: Theme.of(context).brightness == Brightness.dark
          ? const Color(0xFF1E1E1E)
          : Colors.white,
      elevation: 0,
      leading: IconButton(
        icon: const Icon(Icons.arrow_back_rounded),
        onPressed: () => Navigator.pop(context),
      ),
      title: Row(
        children: [
          if (_chat != null) ...[
            Hero(
              tag: 'chat_avatar_${_chat!.id}',
              child: Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  gradient: _getGradientForChat(_chat!.id),
                  shape: BoxShape.circle,
                ),
                child: Center(
                  child: Text(
                    _chat!.avatarInitials,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    _chat!.name,
                    style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w600,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  Text(
                    '${_chat!.participantCount} участников',
                    style: TextStyle(
                      fontSize: 12,
                      color: Colors.grey[600],
                    ),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
      actions: [
        IconButton(
          icon: const Icon(Icons.more_vert_rounded),
          onPressed: () {
            // TODO: Показать меню чата
          },
        ),
      ],
    );
  }

  Widget _buildMessagesList() {
    if (_messages.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              Icons.chat_bubble_outline_rounded,
              size: 64,
              color: Colors.grey[400],
            ),
            const SizedBox(height: 16),
            Text(
              'Нет сообщений',
              style: TextStyle(
                fontSize: 18,
                color: Colors.grey[600],
                fontWeight: FontWeight.w500,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'Напишите первое сообщение!',
              style: TextStyle(
                fontSize: 14,
                color: Colors.grey[500],
              ),
            ),
          ],
        ),
      );
    }

    return ListView.builder(
      controller: _scrollController,
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 16),
      itemCount: _messages.length,
      itemBuilder: (context, index) {
        final message = _messages[index];
        final isMe = message.isMine;
        final showAvatar = !isMe && (index == 0 || _messages[index - 1].sender?.id != message.sender?.id);
        final showTimestamp = index == _messages.length - 1 ||
            _messages[index + 1].timestamp.difference(message.timestamp).inMinutes > 5;

        return _buildMessageBubble(message, isMe, showAvatar, showTimestamp, index);
      },
    );
  }

  Widget _buildMessageBubble(
    ChatMessage message,
    bool isMe,
    bool showAvatar,
    bool showTimestamp,
    int index,
  ) {
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0.0, end: 1.0),
      duration: Duration(milliseconds: 300 + (index * 50).clamp(0, 500)),
      curve: Curves.easeOutCubic,
      builder: (context, value, child) {
        return Opacity(
          opacity: value,
          child: Transform.translate(
            offset: Offset(0, 20 * (1 - value)),
            child: child,
          ),
        );
      },
      child: Padding(
        padding: const EdgeInsets.only(bottom: 8),
        child: Slidable(
          key: Key('msg_${message.id ?? index}'),
          endActionPane: ActionPane(
            motion: const StretchMotion(),
            extentRatio: 0.25,
            children: [
              SlidableAction(
                onPressed: (ctx) {
                  _togglePin(message);
                },
                backgroundColor: Colors.amber,
                foregroundColor: Colors.white,
                icon: _pinnedMessages.any((pm) => pm.message.id == message.id)
                    ? Icons.push_pin
                    : Icons.push_pin_outlined,
                label: _pinnedMessages.any((pm) => pm.message.id == message.id)
                    ? 'Открепить'
                    : 'Закрепить',
                borderRadius: BorderRadius.circular(12),
              ),
            ],
          ),
          child: Row(
            mainAxisAlignment: isMe ? MainAxisAlignment.end : MainAxisAlignment.start,
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              if (!isMe && showAvatar) ...[
              CircleAvatar(
                radius: 16,
                backgroundColor: _getColorForUser(message.sender?.id ?? 0),
                child: Text(
                  message.sender?.name.isNotEmpty == true
                      ? message.sender!.name[0].toUpperCase()
                      : '?',
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 12,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
              const SizedBox(width: 8),
            ] else if (!isMe && !showAvatar)
              const SizedBox(width: 40),
            
            Flexible(
              child: Column(
                crossAxisAlignment: isMe ? CrossAxisAlignment.end : CrossAxisAlignment.start,
                children: [
                  if (!isMe && showAvatar)
                    Padding(
                      padding: const EdgeInsets.only(left: 8, bottom: 4),
                      child: Text(
                        message.sender?.name ?? 'Пользователь',
                        style: TextStyle(
                          fontSize: 12,
                          color: Colors.grey[600],
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  
                  Container(
                    decoration: BoxDecoration(
                      gradient: isMe
                          ? const LinearGradient(
                              colors: [Color(0xFF4CAF50), Color(0xFF81C784)],
                              begin: Alignment.topLeft,
                              end: Alignment.bottomRight,
                            )
                          : null,
                      color: !isMe
                          ? Theme.of(context).brightness == Brightness.dark
                              ? const Color(0xFF2A2A2A)
                              : Colors.white
                          : null,
                      borderRadius: BorderRadius.only(
                        topLeft: const Radius.circular(18),
                        topRight: const Radius.circular(18),
                        bottomLeft: Radius.circular(isMe ? 18 : 4),
                        bottomRight: Radius.circular(isMe ? 4 : 18),
                      ),
                      boxShadow: [
                        BoxShadow(
                          color: isMe
                              ? const Color(0xFF4CAF50).withValues(alpha: 0.3)
                              : Colors.black.withValues(alpha: 0.05),
                          blurRadius: 8,
                          offset: const Offset(0, 2),
                        ),
                      ],
                    ),
                    padding: message.hasMedia 
                        ? EdgeInsets.zero 
                        : const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // Медиа контент
                        if (message.hasMedia) ...[
                          _buildMediaContent(message),
                        ],
                        
                        // Текст сообщения
                        if (message.text.isNotEmpty)
                          Padding(
                            padding: EdgeInsets.symmetric(
                              horizontal: 16,
                              vertical: message.hasMedia ? 8 : 10,
                            ),
                            child: Text(
                              message.text,
                              style: TextStyle(
                                fontSize: 15,
                                color: isMe ? Colors.white : null,
                                height: 1.4,
                              ),
                            ),
                          ),
                      ],
                    ),
                  ),
                  
                  if (showTimestamp)
                    Padding(
                      padding: const EdgeInsets.only(top: 4, left: 8, right: 8),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            DateFormat('HH:mm').format(message.timestamp),
                            style: TextStyle(
                              fontSize: 11,
                              color: Colors.grey[500],
                            ),
                          ),
                          // NEW: Галочки статусов (только для своих сообщений)
                          if (isMe) ...[
                            const SizedBox(width: 4),
                            _buildMessageStatus(message),
                          ],
                        ],
                      ),
                    ),
                ],
              ),
            ),
          ],
        ),
        ),
      ),
    );
  }

  Widget _buildMediaContent(ChatMessage message) {
    // Для изображений используем imageUrl, для видео - fileUrl
    final String? mediaUrl = message.isImage 
        ? message.imageUrl 
        : message.isVideo 
            ? message.fileUrl 
            : null;
    
    if (mediaUrl == null || mediaUrl.isEmpty) return const SizedBox.shrink();

    // Формируем полный URL
    final fullUrl = mediaUrl.startsWith('http') 
        ? mediaUrl 
        : '${AppConfig.apiBaseUrl.replaceAll('/api', '')}$mediaUrl';

    print('🎨 Media URL: $fullUrl (type: ${message.messageType})');

    return ClipRRect(
      borderRadius: const BorderRadius.vertical(top: Radius.circular(18)),
      child: message.isImage 
          ? _buildImageContent(fullUrl)
          : message.isVideo
              ? _buildVideoContent(fullUrl)
              : const SizedBox.shrink(),
    );
  }

  Widget _buildImageContent(String imageUrl) {
    return GestureDetector(
      onTap: () => _showFullScreenMedia(imageUrl, true),
      child: Hero(
        tag: 'image_$imageUrl',
        child: CachedNetworkImage(
          imageUrl: imageUrl,
          width: 250,
          fit: BoxFit.cover,
          placeholder: (context, url) => Container(
            width: 250,
            height: 200,
            color: Colors.grey[300],
            child: const Center(
              child: CircularProgressIndicator(
                color: Color(0xFF4CAF50),
              ),
            ),
          ),
          errorWidget: (context, url, error) => Container(
            width: 250,
            height: 200,
            color: Colors.grey[300],
            child: const Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(Icons.error_outline, size: 48, color: Colors.red),
                SizedBox(height: 8),
                Text('Ошибка загрузки'),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildVideoContent(String videoUrl) {
    return GestureDetector(
      onTap: () => _showFullScreenMedia(videoUrl, false),
      child: Container(
        width: 250,
        height: 200,
        color: Colors.black,
        child: Stack(
          alignment: Alignment.center,
          children: [
            // Превью видео (можно заменить на thumbnail)
            const Icon(
              Icons.play_circle_outline,
              size: 64,
              color: Colors.white,
            ),
            Positioned(
              bottom: 8,
              right: 8,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: Colors.black54,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.videocam, size: 16, color: Colors.white),
                    SizedBox(width: 4),
                    Text(
                      'Видео',
                      style: TextStyle(color: Colors.white, fontSize: 12),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _showFullScreenMedia(String url, bool isImage) {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (context) => Scaffold(
          backgroundColor: Colors.black,
          appBar: AppBar(
            backgroundColor: Colors.black,
            iconTheme: const IconThemeData(color: Colors.white),
          ),
          body: Center(
            child: isImage
                ? Hero(
                    tag: 'image_$url',
                    child: InteractiveViewer(
                      child: CachedNetworkImage(
                        imageUrl: url,
                        fit: BoxFit.contain,
                        placeholder: (context, url) => const CircularProgressIndicator(
                          color: Color(0xFF4CAF50),
                        ),
                      ),
                    ),
                  )
                : VideoPlayerWidget(videoUrl: url),
          ),
        ),
      ),
    );
  }

  /// NEW: Баннер закрепленных сообщений
  Widget _buildPinnedBanner() {
    final pinned = _pinnedMessages.first;
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.amber.shade50,
        border: Border(
          bottom: BorderSide(color: Colors.amber.shade200, width: 2),
        ),
      ),
      child: Row(
        children: [
          Icon(Icons.push_pin, color: Colors.amber.shade700, size: 20),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  'Закрепленное сообщение',
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: Colors.amber.shade900,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  pinned.message.text.isNotEmpty 
                      ? pinned.message.text 
                      : '[${pinned.message.messageType}]',
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: 14,
                    color: Colors.grey[800],
                  ),
                ),
              ],
            ),
          ),
          IconButton(
            icon: const Icon(Icons.close, size: 20),
            onPressed: () => _togglePin(pinned.message),
            tooltip: 'Открепить',
          ),
        ],
      ),
    );
  }

  /// NEW: Галочки статусов прочитанности
  Widget _buildMessageStatus(ChatMessage message) {
    IconData icon;
    Color color;
    
    if (message.isRead) {
      // 2 синих галочки - прочитано
      icon = Icons.done_all;
      color = Colors.blue;
    } else if (message.isDelivered) {
      // 2 серых галочки - доставлено, но не прочитано
      icon = Icons.done_all;
      color = Colors.grey;
    } else {
      // 1 серая галочка - отправлено, но не доставлено (офлайн)
      icon = Icons.done;
      color = Colors.grey;
    }
    
    return Icon(
      icon,
      size: 14,
      color: color,
    );
  }

  /// NEW: Индикатор печати
  Widget _buildTypingIndicator() {
    final user = _typingUsers.first;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      decoration: BoxDecoration(
        color: Theme.of(context).brightness == Brightness.dark
            ? const Color(0xFF1E1E1E)
            : Colors.white,
        border: Border(
          top: BorderSide(
            color: Colors.grey[300]!,
            width: 1,
          ),
        ),
      ),
      child: Row(
        children: [
          _buildTypingAnimation(),
          const SizedBox(width: 8),
          Text(
            '${user.userName} ${user.displayText}',
            style: TextStyle(
              color: Colors.grey[600],
              fontSize: 13,
              fontStyle: FontStyle.italic,
            ),
          ),
        ],
      ),
    );
  }

  /// NEW: Анимация точек для typing indicator
  Widget _buildTypingAnimation() {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: List.generate(
        3,
        (index) => AnimatedDot(delay: Duration(milliseconds: index * 150)),
      ),
    );
  }

  Widget _buildMessageInput() {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        // Превью выбранного медиа
        if (_selectedMedia != null) _buildMediaPreview(),
        
        // Медиа опции
        if (_showMediaOptions) _buildMediaOptions(),
        
        // Основное поле ввода
        Container(
          decoration: BoxDecoration(
            color: Theme.of(context).brightness == Brightness.dark
                ? const Color(0xFF1E1E1E)
                : Colors.white,
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.05),
                blurRadius: 10,
                offset: const Offset(0, -2),
              ),
            ],
          ),
          padding: EdgeInsets.only(
            left: 12,
            right: 12,
            top: 12,
            bottom: MediaQuery.of(context).padding.bottom + 12,
          ),
          child: Row(
            children: [
              // Кнопка прикрепления
              AnimatedContainer(
                duration: const Duration(milliseconds: 200),
                child: Material(
                  color: _showMediaOptions 
                      ? const Color(0xFF4CAF50).withValues(alpha: 0.2)
                      : Colors.transparent,
                  borderRadius: BorderRadius.circular(24),
                  child: InkWell(
                    onTap: _toggleMediaOptions,
                    borderRadius: BorderRadius.circular(24),
                    child: Padding(
                      padding: const EdgeInsets.all(8),
                      child: Icon(
                        _showMediaOptions ? Icons.close : Icons.add_rounded,
                        color: _showMediaOptions 
                            ? const Color(0xFF4CAF50)
                            : Colors.grey[600],
                        size: 28,
                      ),
                    ),
                  ),
                ),
              ),
              
              const SizedBox(width: 8),
              
              // Поле ввода
              Expanded(
                child: Container(
                  decoration: BoxDecoration(
                    color: Theme.of(context).brightness == Brightness.dark
                        ? const Color(0xFF2A2A2A)
                        : const Color(0xFFF5F5F5),
                    borderRadius: BorderRadius.circular(24),
                  ),
                  child: TextField(
                    controller: _messageController,
                    focusNode: _focusNode,
                    maxLines: null,
                    textCapitalization: TextCapitalization.sentences,
                    decoration: InputDecoration(
                      hintText: _selectedMedia != null 
                          ? 'Добавьте подпись...'
                          : 'Сообщение...',
                      hintStyle: TextStyle(color: Colors.grey[500]),
                      border: InputBorder.none,
                      contentPadding: const EdgeInsets.symmetric(
                        horizontal: 20,
                        vertical: 12,
                      ),
                    ),
                    onChanged: (text) {
                      setState(() {});
                      
                      // NEW: Отправляем статус печати
                      if (text.isNotEmpty) {
                        _typingTimer?.cancel();
                        _sendTypingStatus('text');
                        _typingTimer = Timer(const Duration(seconds: 3), () {
                          // Статус истечет через 5 секунд на сервере
                        });
                      }
                    },
                  ),
                ),
              ),
              
              const SizedBox(width: 8),
              
              // Кнопка отправки
              AnimatedContainer(
                duration: const Duration(milliseconds: 200),
                width: 48,
                height: 48,
                child: ScaleTransition(
                  scale: Tween<double>(begin: 1.0, end: 0.9).animate(
                    CurvedAnimation(
                      parent: _sendButtonController,
                      curve: Curves.easeInOut,
                    ),
                  ),
                  child: Material(
                    color: (_messageController.text.trim().isNotEmpty || _selectedMedia != null) && !_isSending
                        ? const Color(0xFF4CAF50)
                        : Colors.grey[300],
                    borderRadius: BorderRadius.circular(24),
                    child: InkWell(
                      onTap: ((_messageController.text.trim().isNotEmpty || _selectedMedia != null) && !_isSending)
                          ? (_selectedMedia != null ? _sendMediaMessage : _sendMessage)
                          : null,
                      borderRadius: BorderRadius.circular(24),
                      child: Center(
                        child: _isSending
                            ? const SizedBox(
                                width: 20,
                                height: 20,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                  valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                                ),
                              )
                            : Icon(
                                Icons.send_rounded,
                                color: (_messageController.text.trim().isNotEmpty || _selectedMedia != null)
                                    ? Colors.white
                                    : Colors.grey[500],
                                size: 22,
                              ),
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildMediaPreview() {
    if (_selectedMedia == null || _mediaType == null) return const SizedBox.shrink();

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Theme.of(context).brightness == Brightness.dark
            ? const Color(0xFF1E1E1E)
            : Colors.white,
        border: Border(
          bottom: BorderSide(
            color: Colors.grey[300]!,
            width: 1,
          ),
        ),
      ),
      child: Row(
        children: [
          // Превью
          Container(
            width: 80,
            height: 80,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(12),
              color: Colors.grey[300],
            ),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(12),
              child: _mediaType == 'image'
                  ? Image.file(
                      _selectedMedia!,
                      fit: BoxFit.cover,
                    )
                  : Container(
                      color: Colors.black,
                      child: const Center(
                        child: Icon(
                          Icons.play_circle_outline,
                          size: 40,
                          color: Colors.white,
                        ),
                      ),
                    ),
            ),
          ),
          
          const SizedBox(width: 12),
          
          // Информация
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  _mediaType == 'image' ? 'Изображение' : 'Видео',
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  _selectedMedia!.path.split('/').last,
                  style: TextStyle(
                    fontSize: 12,
                    color: Colors.grey[600],
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
          
          // Кнопка удаления
          IconButton(
            icon: const Icon(Icons.close, color: Colors.red),
            onPressed: () {
              setState(() {
                _selectedMedia = null;
                _mediaType = null;
              });
            },
          ),
        ],
      ),
    );
  }

  Widget _buildMediaOptions() {
    return SizeTransition(
      sizeFactor: CurvedAnimation(
        parent: _mediaOptionsController,
        curve: Curves.easeOut,
      ),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        decoration: BoxDecoration(
          color: Theme.of(context).brightness == Brightness.dark
              ? const Color(0xFF1E1E1E)
              : Colors.white,
          border: Border(
            bottom: BorderSide(
              color: Colors.grey[300]!,
              width: 1,
            ),
          ),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceEvenly,
          children: [
            _buildMediaOption(
              icon: Icons.photo_library_rounded,
              label: 'Галерея',
              color: const Color(0xFF4CAF50),
              onTap: () => _pickMedia(ImageSource.gallery, 'image'),
            ),
            _buildMediaOption(
              icon: Icons.camera_alt_rounded,
              label: 'Камера',
              color: const Color(0xFF2196F3),
              onTap: () => _pickMedia(ImageSource.camera, 'image'),
            ),
            _buildMediaOption(
              icon: Icons.videocam_rounded,
              label: 'Видео',
              color: const Color(0xFFFF9800),
              onTap: () => _pickMedia(ImageSource.gallery, 'video'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildMediaOption({
    required IconData icon,
    required String label,
    required Color color,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Padding(
        padding: const EdgeInsets.all(8),
        child: Column(
          children: [
            Container(
              width: 56,
              height: 56,
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.15),
                borderRadius: BorderRadius.circular(16),
              ),
              child: Icon(
                icon,
                size: 28,
                color: color,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              label,
              style: TextStyle(
                fontSize: 12,
                color: Colors.grey[700],
                fontWeight: FontWeight.w500,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildLoadingState() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const CircularProgressIndicator(
            color: Color(0xFF4CAF50),
          ),
          const SizedBox(height: 16),
          Text(
            'Загрузка сообщений...',
            style: TextStyle(
              fontSize: 14,
              color: Colors.grey[600],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildErrorState() {
    // Проверяем, это ошибка сети или другая ошибка
    final error = _messagesError!.toLowerCase();
    if (error.contains('подключения') || 
        error.contains('connection') || 
        error.contains('network') || 
        error.contains('socketexception') ||
        error.contains('clientexception') ||
        error.contains('unreachable') ||
        error.contains('timed out') ||
        error.contains('failed host lookup')) {
      // Показываем экран ошибки сети
      return Center(
        child: ErrorScreens.noInternet(
          onRetry: () => _loadMessages(showLoading: true),
          onClose: () {},
        ),
      );
    } else {
      // Другие ошибки показываем через ErrorScreen.loadError
      return Center(
        child: ErrorScreens.loadError(
          onRetry: () => _loadMessages(showLoading: true),
          onClose: () {},
        ),
      );
    }
  }

  LinearGradient _getGradientForChat(int chatId) {
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

  Color _getColorForUser(int userId) {
    final colors = [
      const Color(0xFF1976D2),
      const Color(0xFF4CAF50),
      const Color(0xFFFF9800),
      const Color(0xFF9C27B0),
      const Color(0xFFF44336),
      const Color(0xFF00BCD4),
    ];
    
    return colors[userId % colors.length];
  }
}

// NEW: Animated dot для typing indicator
class AnimatedDot extends StatefulWidget {
  final Duration delay;

  const AnimatedDot({Key? key, required this.delay}) : super(key: key);

  @override
  State<AnimatedDot> createState() => _AnimatedDotState();
}

class _AnimatedDotState extends State<AnimatedDot> with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _animation;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      duration: const Duration(milliseconds: 600),
      vsync: this,
    );
    _animation = Tween<double>(begin: 0.3, end: 1.0).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeInOut),
    );
    
    Future.delayed(widget.delay, () {
      if (mounted) {
        _controller.repeat(reverse: true);
      }
    });
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return FadeTransition(
      opacity: _animation,
      child: Container(
        width: 6,
        height: 6,
        margin: const EdgeInsets.symmetric(horizontal: 2),
        decoration: BoxDecoration(
          color: const Color(0xFF4CAF50),
          shape: BoxShape.circle,
        ),
      ),
    );
  }
}

