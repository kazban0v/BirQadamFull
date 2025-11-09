/// ✅ ИСПРАВЛЕНИЕ НП-11: Skeleton loaders для всех экранов
import 'package:flutter/material.dart';
import 'package:shimmer/shimmer.dart';

class SkeletonLoader extends StatelessWidget {
  final double? width;
  final double? height;
  final double borderRadius;

  const SkeletonLoader({
    Key? key,
    this.width,
    this.height = 16,
    this.borderRadius = 4,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    
    return Shimmer.fromColors(
      baseColor: isDark ? Colors.grey[800]! : Colors.grey[300]!,
      highlightColor: isDark ? Colors.grey[700]! : Colors.grey[100]!,
      child: Container(
        width: width,
        height: height,
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(borderRadius),
        ),
      ),
    );
  }
}

/// Skeleton для карточки проекта
class ProjectCardSkeleton extends StatelessWidget {
  const ProjectCardSkeleton({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const SkeletonLoader(width: 40, height: 40, borderRadius: 20),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: const [
                      SkeletonLoader(width: 150, height: 16),
                      SizedBox(height: 8),
                      SkeletonLoader(width: 100, height: 12),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            const SkeletonLoader(width: double.infinity, height: 120, borderRadius: 8),
            const SizedBox(height: 12),
            const SkeletonLoader(width: double.infinity, height: 14),
            const SizedBox(height: 8),
            const SkeletonLoader(width: double.infinity, height: 14),
            const SizedBox(height: 8),
            const SkeletonLoader(width: 200, height: 14),
            const SizedBox(height: 16),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: const [
                SkeletonLoader(width: 80, height: 12),
                SkeletonLoader(width: 100, height: 32, borderRadius: 16),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

/// Skeleton для карточки задачи
class TaskCardSkeleton extends StatelessWidget {
  const TaskCardSkeleton({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const SkeletonLoader(width: 200, height: 18),
            const SizedBox(height: 12),
            const SkeletonLoader(width: double.infinity, height: 14),
            const SizedBox(height: 8),
            const SkeletonLoader(width: double.infinity, height: 14),
            const SizedBox(height: 16),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: const [
                SkeletonLoader(width: 120, height: 12),
                SkeletonLoader(width: 80, height: 24, borderRadius: 12),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

/// Skeleton для фотоотчета
class PhotoReportSkeleton extends StatelessWidget {
  const PhotoReportSkeleton({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Row(
          children: [
            const SkeletonLoader(width: 80, height: 80, borderRadius: 8),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: const [
                  SkeletonLoader(width: double.infinity, height: 16),
                  SizedBox(height: 8),
                  SkeletonLoader(width: 150, height: 12),
                  SizedBox(height: 8),
                  SkeletonLoader(width: 100, height: 12),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Skeleton для списка достижений
class AchievementSkeleton extends StatelessWidget {
  const AchievementSkeleton({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            const SkeletonLoader(width: 60, height: 60, borderRadius: 30),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: const [
                  SkeletonLoader(width: 180, height: 16),
                  SizedBox(height: 8),
                  SkeletonLoader(width: double.infinity, height: 12),
                  SizedBox(height: 8),
                  SkeletonLoader(width: 120, height: 12),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Skeleton для профиля
class ProfileSkeleton extends StatelessWidget {
  const ProfileSkeleton({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        const SizedBox(height: 40),
        const SkeletonLoader(width: 100, height: 100, borderRadius: 50),
        const SizedBox(height: 16),
        const SkeletonLoader(width: 200, height: 24),
        const SizedBox(height: 8),
        const SkeletonLoader(width: 150, height: 16),
        const SizedBox(height: 32),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 24),
          child: Column(
            children: [
              _buildStatRow(),
              const SizedBox(height: 16),
              _buildStatRow(),
              const SizedBox(height: 16),
              _buildStatRow(),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildStatRow() {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceAround,
      children: const [
        SkeletonLoader(width: 100, height: 60, borderRadius: 8),
        SkeletonLoader(width: 100, height: 60, borderRadius: 8),
        SkeletonLoader(width: 100, height: 60, borderRadius: 8),
      ],
    );
  }
}

/// Skeleton для списка (универсальный)
class ListSkeleton extends StatelessWidget {
  final Widget itemSkeleton;
  final int itemCount;

  const ListSkeleton({
    Key? key,
    required this.itemSkeleton,
    this.itemCount = 5,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return ListView.builder(
      itemCount: itemCount,
      physics: const NeverScrollableScrollPhysics(),
      itemBuilder: (context, index) => itemSkeleton,
    );
  }
}
