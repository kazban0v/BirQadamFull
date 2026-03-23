import 'package:flutter/material.dart';
import '../../theme/app_colors.dart';

/// Custom avatar component with initials fallback
class AppAvatar extends StatelessWidget {
  final String? imageUrl;
  final String? name;
  final double size;
  final Color? backgroundColor;
  final bool showBorder;
  final bool showOnlineIndicator;
  final VoidCallback? onTap;

  const AppAvatar({
    super.key,
    this.imageUrl,
    this.name,
    this.size = 48,
    this.backgroundColor,
    this.showBorder = false,
    this.showOnlineIndicator = false,
    this.onTap,
  });

  String _getInitials() {
    if (name == null || name!.isEmpty) return '?';
    
    final words = name!.trim().split(' ');
    if (words.length >= 2) {
      return '${words[0][0]}${words[1][0]}'.toUpperCase();
    }
    return name![0].toUpperCase();
  }

  Color _getBackgroundColor() {
    if (backgroundColor != null) return backgroundColor!;
    
    // Generate color based on name
    if (name != null && name!.isNotEmpty) {
      final hash = name!.hashCode;
      final colors = [
        AppColors.primary,
        AppColors.accent,
        AppColors.success,
        Colors.purple,
        Colors.orange,
        Colors.teal,
        Colors.pink,
        Colors.indigo,
      ];
      return colors[hash.abs() % colors.length];
    }
    
    return AppColors.primary;
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Stack(
        children: [
          Container(
            width: size,
            height: size,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              border: showBorder
                  ? Border.all(
                      color: Colors.white,
                      width: 3,
                    )
                  : null,
              boxShadow: showBorder
                  ? [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.1),
                        blurRadius: 8,
                        offset: const Offset(0, 2),
                      ),
                    ]
                  : null,
            ),
            child: ClipOval(
              child: imageUrl != null && imageUrl!.isNotEmpty
                  ? Image.network(
                      imageUrl!,
                      width: size,
                      height: size,
                      fit: BoxFit.cover,
                      errorBuilder: (context, error, stackTrace) {
                        return _buildInitialsAvatar();
                      },
                      loadingBuilder: (context, child, loadingProgress) {
                        if (loadingProgress == null) return child;
                        return _buildInitialsAvatar();
                      },
                    )
                  : _buildInitialsAvatar(),
            ),
          ),
          
          // Online indicator
          if (showOnlineIndicator)
            Positioned(
              right: 0,
              bottom: 0,
              child: Container(
                width: size * 0.25,
                height: size * 0.25,
                decoration: BoxDecoration(
                  color: AppColors.primary,
                  shape: BoxShape.circle,
                  border: Border.all(
                    color: Colors.white,
                    width: 2,
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildInitialsAvatar() {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: _getBackgroundColor(),
        shape: BoxShape.circle,
      ),
      child: Center(
        child: Text(
          _getInitials(),
          style: TextStyle(
            fontSize: size * 0.4,
            fontWeight: FontWeight.bold,
            color: Colors.white,
          ),
        ),
      ),
    );
  }
}

/// Avatar with name and subtitle
class AvatarWithInfo extends StatelessWidget {
  final String? imageUrl;
  final String name;
  final String? subtitle;
  final double avatarSize;
  final bool showOnlineIndicator;
  final VoidCallback? onTap;

  const AvatarWithInfo({
    super.key,
    this.imageUrl,
    required this.name,
    this.subtitle,
    this.avatarSize = 48,
    this.showOnlineIndicator = false,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Row(
        children: [
          AppAvatar(
            imageUrl: imageUrl,
            name: name,
            size: avatarSize,
            showOnlineIndicator: showOnlineIndicator,
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  name,
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w600,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                if (subtitle != null) ...[
                  const SizedBox(height: 2),
                  Text(
                    subtitle!,
                    style: TextStyle(
                      fontSize: 14,
                      color: Colors.grey.shade600,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

