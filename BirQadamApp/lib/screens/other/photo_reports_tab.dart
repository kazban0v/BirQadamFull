import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/photo_reports_provider.dart';
import '../../models/photo_report.dart';
import '../../widgets/dialogs/view_photo_report_dialog.dart';

class PhotoReportsTab extends StatefulWidget {
  const PhotoReportsTab({super.key});

  @override
  State<PhotoReportsTab> createState() => _PhotoReportsTabState();
}

class _PhotoReportsTabState extends State<PhotoReportsTab> {
  String _selectedFilter = 'new'; // 'new' или 'all'

  @override
  void initState() {
    super.initState();
    // Загружаем фотоотчеты при инициализации
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<PhotoReportsProvider>().loadPhotoReports(filter: _selectedFilter);
    });
  }

  String _formatDate(DateTime date) {
    return '${date.day.toString().padLeft(2, '0')}.${date.month.toString().padLeft(2, '0')}.${date.year} ${date.hour.toString().padLeft(2, '0')}:${date.minute.toString().padLeft(2, '0')}';
  }

  @override
  Widget build(BuildContext context) {
    final photoReportsProvider = context.watch<PhotoReportsProvider>();
    final filteredReports = photoReportsProvider.getFilteredReports(_selectedFilter);

    return Column(
      children: [
        // Заголовок
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: Colors.white,
            border: Border(
              bottom: BorderSide(color: Colors.grey.shade200),
            ),
          ),
          child: const Text(
            'Фотоотчеты волонтеров',
            style: TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.bold,
              color: Color(0xFF2E7D32),
            ),
          ),
        ),

        // Фильтры (упрощенные FilterChips)
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          decoration: BoxDecoration(
            color: Colors.white,
            border: Border(
              bottom: BorderSide(color: Colors.grey.shade200),
            ),
          ),
          child: Row(
            children: [
              _buildFilterChip(
                label: 'Новые',
                isSelected: _selectedFilter == 'new',
                count: photoReportsProvider.newCount,
                onTap: () {
                  setState(() {
                    _selectedFilter = 'new';
                  });
                  photoReportsProvider.loadPhotoReports(filter: 'new');
                },
              ),
              const SizedBox(width: 12),
              _buildFilterChip(
                label: 'Все',
                isSelected: _selectedFilter == 'all',
                onTap: () {
                  setState(() {
                    _selectedFilter = 'all';
                  });
                  photoReportsProvider.loadPhotoReports(filter: 'all');
                },
              ),
            ],
          ),
        ),

        // Список фотоотчетов
        Expanded(
          child: photoReportsProvider.isLoading
              ? const Center(child: CircularProgressIndicator())
              : filteredReports.isEmpty
                  ? _buildEmptyState()
                  : RefreshIndicator(
                      onRefresh: () => photoReportsProvider.loadPhotoReports(filter: _selectedFilter),
                      child: ListView.builder(
                        padding: const EdgeInsets.all(16),
                        itemCount: filteredReports.length,
                        itemBuilder: (context, index) {
                          final report = filteredReports[index];
                          return _buildPhotoReportCard(report);
                        },
                      ),
                    ),
        ),
      ],
    );
  }

  Widget _buildFilterChip({
    required String label,
    required bool isSelected,
    int? count,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 300),
        curve: Curves.easeInOut,
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
        decoration: BoxDecoration(
          color: isSelected ? const Color(0xFF4CAF50) : Colors.grey.shade100,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: isSelected ? const Color(0xFF4CAF50) : Colors.grey.shade300,
            width: isSelected ? 2 : 1,
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              label,
              style: TextStyle(
                fontSize: 14,
                fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
                color: isSelected ? Colors.white : Colors.grey.shade700,
              ),
            ),
            if (count != null && count > 0) ...[
              const SizedBox(width: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                decoration: BoxDecoration(
                  color: isSelected ? Colors.white : const Color(0xFFF44336),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text(
                  count.toString(),
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.bold,
                    color: isSelected ? const Color(0xFF4CAF50) : Colors.white,
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildPhotoReportCard(PhotoReport report) {
    return Card(
      margin: const EdgeInsets.only(bottom: 16),
      elevation: 4,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Заголовок карточки
            Row(
              children: [
                const Icon(
                  Icons.photo_camera,
                  color: Color(0xFF4CAF50),
                  size: 20,
                ),
                const SizedBox(width: 8),
                const Text(
                  'Фотоотчет',
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                    color: Color(0xFF2E7D32),
                  ),
                ),
                const Spacer(),
                _buildStatusBadge(report.status, report.rating),
              ],
            ),
            const SizedBox(height: 12),

            // Информация
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: const Color(0xFFF1F8E9),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      const Icon(Icons.assignment, size: 16, color: Color(0xFF4CAF50)),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          'Задача: ${report.taskText}',
                          style: const TextStyle(
                            fontSize: 14,
                            color: Colors.black87,
                            fontWeight: FontWeight.w500,
                          ),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      const Icon(Icons.person, size: 16, color: Color(0xFF2196F3)),
                      const SizedBox(width: 8),
                      Text(
                        'Волонтёр: ${report.volunteerName}',
                        style: const TextStyle(fontSize: 14, color: Colors.black87),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      const Icon(Icons.calendar_today, size: 16, color: Color(0xFF666666)),
                      const SizedBox(width: 8),
                      Text(
                        _formatDate(report.uploadedAt),
                        style: const TextStyle(fontSize: 12, color: Color(0xFF666666)),
                      ),
                    ],
                  ),
                ],
              ),
            ),

            const SizedBox(height: 12),

            // Превью фото
            if (report.imageUrl.isNotEmpty)
              ClipRRect(
                borderRadius: BorderRadius.circular(12),
                child: Image.network(
                  report.imageUrl,
                  width: double.infinity,
                  height: 150,
                  fit: BoxFit.cover,
                  errorBuilder: (context, error, stackTrace) {
                    return Container(
                      width: double.infinity,
                      height: 150,
                      color: Colors.grey[300],
                      child: const Icon(Icons.broken_image, size: 48, color: Colors.grey),
                    );
                  },
                ),
              ),

            const SizedBox(height: 16),

            // Кнопка просмотра
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: () => _showPhotoReportDialog(report),
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF2196F3),
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                  elevation: 2,
                ),
                child: const Text(
                  'ПРОСМОТРЕТЬ',
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildStatusBadge(String status, int? rating) {
    Color color;
    String text;

    if (status == 'pending') {
      color = const Color(0xFFFF9800);
      text = 'Ожидает оценки';
    } else if (status == 'approved') {
      color = const Color(0xFF4CAF50);
      text = rating != null ? 'Одобрено ($rating★)' : 'Одобрено';
    } else {
      color = const Color(0xFFF44336);
      text = 'Отклонено';
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: color,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Text(
        text,
        style: const TextStyle(
          color: Colors.white,
          fontSize: 12,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            Icons.photo_library,
            size: 64,
            color: Colors.grey[400],
          ),
          const SizedBox(height: 16),
          Text(
            _selectedFilter == 'new' 
                ? 'Нет новых фотоотчетов'
                : 'Нет фотоотчетов',
            style: const TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.w600,
              color: Color(0xFF666666),
            ),
          ),
          const SizedBox(height: 8),
          Text(
            _selectedFilter == 'new'
                ? 'Здесь появятся новые фотоотчеты,\nкоторые нужно оценить'
                : 'Фотоотчеты волонтеров появятся здесь',
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 14,
              color: Colors.grey[600],
            ),
          ),
        ],
      ),
    );
  }

  void _showPhotoReportDialog(PhotoReport report) {
    showDialog(
      context: context,
      builder: (context) => ViewPhotoReportDialog(photoReport: report),
    ).then((result) {
      if (result == true) {
        // Обновляем список после оценки/отклонения
        context.read<PhotoReportsProvider>().loadPhotoReports(filter: _selectedFilter);
      }
    });
  }
}