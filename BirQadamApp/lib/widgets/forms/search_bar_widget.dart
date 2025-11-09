import 'package:flutter/material.dart';

/// Кастомный search bar с фильтрами
class SearchBarWidget extends StatefulWidget {
  final String hintText;
  final Function(String) onSearch;
  final VoidCallback? onFilterTap;
  final bool showFilter;
  final TextEditingController? controller;

  const SearchBarWidget({
    Key? key,
    this.hintText = 'Поиск...',
    required this.onSearch,
    this.onFilterTap,
    this.showFilter = true,
    this.controller,
  }) : super(key: key);

  @override
  State<SearchBarWidget> createState() => _SearchBarWidgetState();
}

class _SearchBarWidgetState extends State<SearchBarWidget> {
  late TextEditingController _controller;
  bool _isSearching = false;

  @override
  void initState() {
    super.initState();
    _controller = widget.controller ?? TextEditingController();
    _controller.addListener(() {
      if (_controller.text.isNotEmpty && !_isSearching) {
        setState(() => _isSearching = true);
      } else if (_controller.text.isEmpty && _isSearching) {
        setState(() => _isSearching = false);
      }
    });
  }

  @override
  void dispose() {
    if (widget.controller == null) {
      _controller.dispose();
    }
    super.dispose();
  }

  void _clearSearch() {
    _controller.clear();
    widget.onSearch('');
    FocusScope.of(context).unfocus();
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.05),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Row(
        children: [
          Expanded(
            child: TextField(
              controller: _controller,
              onChanged: widget.onSearch,
              decoration: InputDecoration(
                hintText: widget.hintText,
                hintStyle: TextStyle(
                  color: Colors.grey[400],
                  fontSize: 15,
                ),
                prefixIcon: Icon(
                  Icons.search_rounded,
                  color: Colors.grey[400],
                  size: 24,
                ),
                suffixIcon: _isSearching
                    ? IconButton(
                        icon: Icon(
                          Icons.close_rounded,
                          color: Colors.grey[600],
                          size: 20,
                        ),
                        onPressed: _clearSearch,
                      )
                    : null,
                border: InputBorder.none,
                contentPadding: const EdgeInsets.symmetric(
                  horizontal: 16,
                  vertical: 14,
                ),
              ),
              style: const TextStyle(
                fontSize: 15,
                color: Color(0xFF212121),
              ),
            ),
          ),
          if (widget.showFilter && widget.onFilterTap != null) ...[
            Container(
              width: 1,
              height: 24,
              color: Colors.grey[300],
            ),
            IconButton(
              icon: Icon(
                Icons.tune_rounded,
                color: Colors.grey[600],
                size: 24,
              ),
              onPressed: widget.onFilterTap,
              tooltip: 'Фильтры',
            ),
          ],
        ],
      ),
    );
  }
}

/// Chip для отображения активных фильтров
class FilterChip extends StatelessWidget {
  final String label;
  final VoidCallback onRemove;

  const FilterChip({
    Key? key,
    required this.label,
    required this.onRemove,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(right: 8),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: const Color(0xFF4CAF50).withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: const Color(0xFF4CAF50).withValues(alpha: 0.3),
        ),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            label,
            style: const TextStyle(
              fontSize: 13,
              color: Color(0xFF4CAF50),
              fontWeight: FontWeight.w500,
            ),
          ),
          const SizedBox(width: 6),
          GestureDetector(
            onTap: onRemove,
            child: const Icon(
              Icons.close_rounded,
              size: 16,
              color: Color(0xFF4CAF50),
            ),
          ),
        ],
      ),
    );
  }
}
