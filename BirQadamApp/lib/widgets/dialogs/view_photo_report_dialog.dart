import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../models/photo_report.dart';
import '../../providers/photo_reports_provider.dart';
import 'rate_photo_report_dialog.dart';
import 'reject_photo_report_dialog.dart';

class ViewPhotoReportDialog extends StatefulWidget {
  final PhotoReport photoReport;

  const ViewPhotoReportDialog({
    super.key,
    required this.photoReport,
  });

  @override
  State<ViewPhotoReportDialog> createState() => _ViewPhotoReportDialogState();
}

class _ViewPhotoReportDialogState extends State<ViewPhotoReportDialog> {
  int _currentPhotoIndex = 0;
  PhotoReport? _detailedReport;
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadPhotoDetails();
  }

  Future<void> _loadPhotoDetails() async {
    final provider = context.read<PhotoReportsProvider>();
    final details = await provider.getPhotoReportDetail(widget.photoReport.id);
    
    if (mounted) {
      setState(() {
        _detailedReport = details ?? widget.photoReport;
        _isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final report = _detailedReport ?? widget.photoReport;
    final photos = report.photos ?? [];

    return Dialog(
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(20),
      ),
      child: Container(
        width: MediaQuery.of(context).size.width * 0.95,
        constraints: const BoxConstraints(maxHeight: 700),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Заголовок с градиентом
            Container(
              padding: const EdgeInsets.all(20),
              decoration: const BoxDecoration(
                gradient: LinearGradient(
                  colors: [Color(0xFF4CAF50), Color(0xFF66BB6A)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.only(
                  topLeft: Radius.circular(20),
                  topRight: Radius.circular(20),
                ),
              ),
              child: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.2),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: const Icon(
                      Icons.photo_camera,
                      color: Colors.white,
                      size: 24,
                    ),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'Фотоотчет',
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 20,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        Text(
                          'Задача: "${report.taskText.length > 25 ? '${report.taskText.substring(0, 25)}...' : report.taskText}"',
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 12,
                            fontWeight: FontWeight.w500,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                        Text(
                          'Волонтёр: ${report.volunteerName}',
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 12,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ],
                    ),
                  ),
                  IconButton(
                    onPressed: () => Navigator.pop(context),
                    icon: const Icon(
                      Icons.close,
                      color: Colors.white,
                      size: 24,
                    ),
                  ),
                ],
              ),
            ),

            // Содержимое
            Flexible(
              child: _isLoading
                  ? const Center(child: CircularProgressIndicator())
                  : SingleChildScrollView(
                      padding: const EdgeInsets.all(20),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          // Галерея фото (горизонтальный scroll)
                          if (photos.isNotEmpty)
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Text(
                                  'Фотографии:',
                                  style: TextStyle(
                                    fontSize: 14,
                                    fontWeight: FontWeight.w600,
                                    color: Color(0xFF2E7D32),
                                  ),
                                ),
                                const SizedBox(height: 12),
                                SizedBox(
                                  height: 120,
                                  child: ListView.builder(
                                    scrollDirection: Axis.horizontal,
                                    itemCount: photos.length,
                                    itemBuilder: (context, index) {
                                      return GestureDetector(
                                        onTap: () {
                                          setState(() {
                                            _currentPhotoIndex = index;
                                          });
                                        },
                                        child: Container(
                                          margin: const EdgeInsets.only(right: 8),
                                          decoration: BoxDecoration(
                                            border: Border.all(
                                              color: _currentPhotoIndex == index
                                                  ? const Color(0xFF4CAF50)
                                                  : Colors.transparent,
                                              width: 3,
                                            ),
                                            borderRadius: BorderRadius.circular(12),
                                          ),
                                          child: ClipRRect(
                                            borderRadius: BorderRadius.circular(12),
                                            child: Image.network(
                                              photos[index].imageUrl,
                                              width: 120,
                                              height: 120,
                                              fit: BoxFit.cover,
                                              errorBuilder: (context, error, stackTrace) {
                                                return Container(
                                                  width: 120,
                                                  height: 120,
                                                  color: Colors.grey[300],
                                                  child: const Icon(Icons.broken_image),
                                                );
                                              },
                                            ),
                                          ),
                                        ),
                                      );
                                    },
                                  ),
                                ),
                              ],
                            )
                          else
                            ClipRRect(
                              borderRadius: BorderRadius.circular(16),
                              child: Image.network(
                                report.imageUrl,
                                width: double.infinity,
                                height: 250,
                                fit: BoxFit.cover,
                                errorBuilder: (context, error, stackTrace) {
                                  return Container(
                                    width: double.infinity,
                                    height: 250,
                                    color: Colors.grey[300],
                                    child: const Icon(Icons.broken_image, size: 64),
                                  );
                                },
                              ),
                            ),

                          const SizedBox(height: 20),

                          // Комментарий волонтёра
                          if (report.volunteerComment.isNotEmpty) ...[
                            const Row(
                              children: [
                                Icon(Icons.comment, color: Color(0xFF2196F3), size: 20),
                                SizedBox(width: 8),
                                Text(
                                  'Комментарий волонтёра:',
                                  style: TextStyle(
                                    fontSize: 14,
                                    fontWeight: FontWeight.w600,
                                    color: Color(0xFF2E7D32),
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 8),
                            Container(
                              width: double.infinity,
                              padding: const EdgeInsets.all(16),
                              decoration: BoxDecoration(
                                color: const Color(0xFFF8F9FA),
                                borderRadius: BorderRadius.circular(12),
                                border: Border.all(color: Colors.grey[300]!),
                              ),
                              child: Text(
                                report.volunteerComment,
                                style: const TextStyle(
                                  fontSize: 14,
                                  color: Colors.black87,
                                  height: 1.5,
                                ),
                              ),
                            ),
                            const SizedBox(height: 20),
                          ],

                          // Показываем кнопки только если фото еще не оценено
                          if (report.status == 'pending') ...[
                            Row(
                              children: [
                                Expanded(
                                  child: ElevatedButton(
                                    onPressed: () => _showRejectDialog(),
                                    style: ElevatedButton.styleFrom(
                                      backgroundColor: const Color(0xFFF44336),
                                      foregroundColor: Colors.white,
                                      padding: const EdgeInsets.symmetric(vertical: 16),
                                      shape: RoundedRectangleBorder(
                                        borderRadius: BorderRadius.circular(12),
                                      ),
                                      elevation: 2,
                                    ),
                                    child: const Text(
                                      'ОТКЛОНИТЬ',
                                      style: TextStyle(
                                        fontSize: 16,
                                        fontWeight: FontWeight.w600,
                                      ),
                                    ),
                                  ),
                                ),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: ElevatedButton(
                                    onPressed: () => _showRateDialog(),
                                    style: ElevatedButton.styleFrom(
                                      backgroundColor: const Color(0xFF4CAF50),
                                      foregroundColor: Colors.white,
                                      padding: const EdgeInsets.symmetric(vertical: 16),
                                      shape: RoundedRectangleBorder(
                                        borderRadius: BorderRadius.circular(12),
                                      ),
                                      elevation: 2,
                                    ),
                                    child: const Text(
                                      'ОЦЕНИТЬ',
                                      style: TextStyle(
                                        fontSize: 16,
                                        fontWeight: FontWeight.w600,
                                      ),
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ] else ...[
                            // Показываем результат оценки
                            Container(
                              padding: const EdgeInsets.all(16),
                              decoration: BoxDecoration(
                                color: report.status == 'approved'
                                    ? const Color(0xFFE8F5E8)
                                    : const Color(0xFFFFEBEE),
                                borderRadius: BorderRadius.circular(12),
                                border: Border.all(
                                  color: report.status == 'approved'
                                      ? const Color(0xFF4CAF50)
                                      : const Color(0xFFF44336),
                                ),
                              ),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    children: [
                                      Icon(
                                        report.status == 'approved' ? Icons.check_circle : Icons.cancel,
                                        color: report.status == 'approved'
                                            ? const Color(0xFF4CAF50)
                                            : const Color(0xFFF44336),
                                        size: 24,
                                      ),
                                      const SizedBox(width: 8),
                                      Text(
                                        report.status == 'approved' ? 'Одобрено' : 'Отклонено',
                                        style: TextStyle(
                                          fontSize: 16,
                                          fontWeight: FontWeight.bold,
                                          color: report.status == 'approved'
                                              ? const Color(0xFF2E7D32)
                                              : const Color(0xFFC62828),
                                        ),
                                      ),
                                      if (report.rating != null) ...[
                                        const Spacer(),
                                        Row(
                                          children: List.generate(5, (index) {
                                            return Icon(
                                              index < report.rating! ? Icons.star : Icons.star_border,
                                              color: const Color(0xFFFFC107),
                                              size: 20,
                                            );
                                          }),
                                        ),
                                      ],
                                    ],
                                  ),
                                  // Показываем комментарий организатора если одобрено, или причину отклонения если отклонено
                                  if (report.status == 'approved' && report.organizerComment.isNotEmpty) ...[
                                    const SizedBox(height: 12),
                                    const Divider(),
                                    const SizedBox(height: 8),
                                    Text(
                                      'Комментарий организатора:',
                                      style: TextStyle(
                                        fontSize: 12,
                                        fontWeight: FontWeight.w600,
                                        color: Colors.grey[700],
                                      ),
                                    ),
                                    const SizedBox(height: 4),
                                    Text(
                                      report.organizerComment,
                                      style: const TextStyle(
                                        fontSize: 14,
                                        color: Colors.black87,
                                      ),
                                    ),
                                  ],
                                  if (report.status == 'rejected' && report.rejectionReason.isNotEmpty) ...[
                                    const SizedBox(height: 12),
                                    const Divider(),
                                    const SizedBox(height: 8),
                                    Text(
                                      'Причина отклонения:',
                                      style: TextStyle(
                                        fontSize: 12,
                                        fontWeight: FontWeight.w600,
                                        color: Colors.red[700],
                                      ),
                                    ),
                                    const SizedBox(height: 4),
                                    Text(
                                      report.rejectionReason,
                                      style: const TextStyle(
                                        fontSize: 14,
                                        color: Colors.black87,
                                      ),
                                    ),
                                  ],
                                ],
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),
            ),
          ],
        ),
      ),
    );
  }

  void _showRateDialog() async {
    final result = await showDialog<bool>(
      context: context,
      builder: (context) => RatePhotoReportDialog(
        photoReport: widget.photoReport,
      ),
    );

    if (result == true && mounted) {
      Navigator.pop(context, true);
    }
  }

  void _showRejectDialog() async {
    final result = await showDialog<bool>(
      context: context,
      builder: (context) => RejectPhotoReportDialog(
        photoReport: widget.photoReport,
      ),
    );

    if (result == true && mounted) {
      Navigator.pop(context, true);
    }
  }
}