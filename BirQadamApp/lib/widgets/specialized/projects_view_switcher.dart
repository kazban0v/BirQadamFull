import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/map_provider.dart';
import '../../screens/map/map_screen.dart';
import '../../theme/app_colors.dart';

/// Виджет переключения между списком проектов и картой
class ProjectsViewSwitcher extends StatefulWidget {
  /// Виджет списка проектов
  final Widget listView;

  const ProjectsViewSwitcher({
    Key? key,
    required this.listView,
  }) : super(key: key);

  @override
  State<ProjectsViewSwitcher> createState() => _ProjectsViewSwitcherState();
}

class _ProjectsViewSwitcherState extends State<ProjectsViewSwitcher> {
  bool _isMapView = false;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        // Переключатель вид: Список / Карта
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          child: Container(
            decoration: BoxDecoration(
              color: Colors.grey[200],
              borderRadius: BorderRadius.circular(12),
            ),
            child: Row(
              children: [
                Expanded(
                  child: _buildViewButton(
                    icon: Icons.list,
                    label: 'Список',
                    isSelected: !_isMapView,
                    onTap: () {
                      setState(() {
                        _isMapView = false;
                      });
                    },
                  ),
                ),
                Expanded(
                  child: _buildViewButton(
                    icon: Icons.map,
                    label: 'Карта',
                    isSelected: _isMapView,
                    onTap: () {
                      setState(() {
                        _isMapView = true;
                      });
                      // Загружаем маркеры при переключении на карту (только если еще не загружены)
                      final mapProvider = context.read<MapProvider>();
                      if (mapProvider.markers.isEmpty && !mapProvider.isLoading) {
                        mapProvider.loadMarkers();
                      }
                    },
                  ),
                ),
              ],
            ),
          ),
        ),

        // Контент: список или карта
        Expanded(
          child: _isMapView
              ? const _EmbeddedMapView()
              : widget.listView,
        ),
      ],
    );
  }

  Widget _buildViewButton({
    required IconData icon,
    required String label,
    required bool isSelected,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(vertical: 12),
        decoration: BoxDecoration(
          color: isSelected ? Colors.white : Colors.transparent,
          borderRadius: BorderRadius.circular(10),
          boxShadow: isSelected
              ? [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.1),
                    blurRadius: 4,
                    offset: const Offset(0, 2),
                  ),
                ]
              : [],
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              icon,
              color: isSelected ? AppColors.primary : Colors.grey[600],
              size: 20,
            ),
            const SizedBox(width: 6),
            Text(
              label,
              style: TextStyle(
                color: isSelected ? AppColors.primary : Colors.grey[600],
                fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                fontSize: 14,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Встроенный вид карты (без AppBar, так как он уже есть в родительском экране)
class _EmbeddedMapView extends StatelessWidget {
  const _EmbeddedMapView({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    // Используем существующий MapProvider из дерева виджетов
    return const MapScreen();
  }
}

