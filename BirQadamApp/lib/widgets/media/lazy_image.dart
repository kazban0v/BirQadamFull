/// ✅ ИСПРАВЛЕНИЕ НП-9: Lazy loading изображений с кешированием
import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:shimmer/shimmer.dart';

class LazyImage extends StatelessWidget {
  final String imageUrl;
  final double? width;
  final double? height;
  final BoxFit fit;
  final BorderRadius? borderRadius;
  final Widget? errorWidget;
  final Widget? placeholder;

  const LazyImage({
    Key? key,
    required this.imageUrl,
    this.width,
    this.height,
    this.fit = BoxFit.cover,
    this.borderRadius,
    this.errorWidget,
    this.placeholder,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: borderRadius ?? BorderRadius.zero,
      child: CachedNetworkImage(
        imageUrl: imageUrl,
        width: width,
        height: height,
        fit: fit,
        
        // Placeholder во время загрузки с shimmer эффектом
        placeholder: (context, url) => placeholder ?? _buildShimmerPlaceholder(),
        
        // Виджет ошибки
        errorWidget: (context, url, error) => errorWidget ?? _buildErrorWidget(),
        
        // Настройки кеширования
        memCacheWidth: width != null ? (width! * 2).toInt() : null,
        memCacheHeight: height != null ? (height! * 2).toInt() : null,
        
        // Плавное появление
        fadeInDuration: const Duration(milliseconds: 300),
        fadeOutDuration: const Duration(milliseconds: 100),
      ),
    );
  }

  /// Shimmer placeholder во время загрузки
  Widget _buildShimmerPlaceholder() {
    return Shimmer.fromColors(
      baseColor: Colors.grey[300]!,
      highlightColor: Colors.grey[100]!,
      child: Container(
        width: width,
        height: height,
        color: Colors.white,
      ),
    );
  }

  /// Виджет ошибки загрузки
  Widget _buildErrorWidget() {
    return Container(
      width: width,
      height: height,
      color: Colors.grey[200],
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            Icons.broken_image,
            size: 48,
            color: Colors.grey[400],
          ),
          const SizedBox(height: 8),
          Text(
            'Ошибка загрузки',
            style: TextStyle(
              color: Colors.grey[600],
              fontSize: 12,
            ),
          ),
        ],
      ),
    );
  }
}

/// Avatar lazy loading с круглым placeholder
class LazyAvatar extends StatelessWidget {
  final String imageUrl;
  final double radius;
  final String? placeholderText;

  const LazyAvatar({
    Key? key,
    required this.imageUrl,
    this.radius = 20,
    this.placeholderText,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return CircleAvatar(
      radius: radius,
      backgroundColor: Colors.grey[300],
      child: imageUrl.isNotEmpty
          ? ClipOval(
              child: CachedNetworkImage(
                imageUrl: imageUrl,
                width: radius * 2,
                height: radius * 2,
                fit: BoxFit.cover,
                placeholder: (context, url) => _buildPlaceholder(),
                errorWidget: (context, url, error) => _buildPlaceholder(),
                fadeInDuration: const Duration(milliseconds: 200),
              ),
            )
          : _buildPlaceholder(),
    );
  }

  Widget _buildPlaceholder() {
    return Container(
      width: radius * 2,
      height: radius * 2,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: Colors.grey[300],
      ),
      child: Center(
        child: placeholderText != null && placeholderText!.isNotEmpty
            ? Text(
                placeholderText![0].toUpperCase(),
                style: TextStyle(
                  fontSize: radius * 0.8,
                  fontWeight: FontWeight.bold,
                  color: Colors.grey[600],
                ),
              )
            : Icon(
                Icons.person,
                size: radius,
                color: Colors.grey[600],
              ),
      ),
    );
  }
}

/// Thumbnail с lazy loading для списков
class LazyThumbnail extends StatelessWidget {
  final String imageUrl;
  final double size;
  final VoidCallback? onTap;

  const LazyThumbnail({
    Key? key,
    required this.imageUrl,
    this.size = 60,
    this.onTap,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: LazyImage(
        imageUrl: imageUrl,
        width: size,
        height: size,
        fit: BoxFit.cover,
        borderRadius: BorderRadius.circular(8),
      ),
    );
  }
}



