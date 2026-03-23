/// ✅ ИСПРАВЛЕНИЕ НП-10: Pull-to-refresh обертка для списков
import 'package:flutter/material.dart';

class RefreshableList extends StatelessWidget {
  final Future<void> Function() onRefresh;
  final Widget child;
  final Color? indicatorColor;
  final double displacement;

  const RefreshableList({
    Key? key,
    required this.onRefresh,
    required this.child,
    this.indicatorColor,
    this.displacement = 40.0,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: onRefresh,
      color: indicatorColor ?? Theme.of(context).primaryColor,
      displacement: displacement,
      strokeWidth: 2.5,
      child: child,
    );
  }
}

/// Pull-to-refresh с кастомной анимацией и сообщением
class RefreshableListView extends StatefulWidget {
  final Future<void> Function() onRefresh;
  final List<Widget> children;
  final Widget? emptyWidget;
  final String? refreshMessage;
  final ScrollController? controller;
  final EdgeInsetsGeometry? padding;

  const RefreshableListView({
    Key? key,
    required this.onRefresh,
    required this.children,
    this.emptyWidget,
    this.refreshMessage,
    this.controller,
    this.padding,
  }) : super(key: key);

  @override
  State<RefreshableListView> createState() => _RefreshableListViewState();
}

class _RefreshableListViewState extends State<RefreshableListView> {
  bool _isRefreshing = false;
  String? _lastRefreshMessage;

  Future<void> _handleRefresh() async {
    if (_isRefreshing) return;

    setState(() {
      _isRefreshing = true;
    });

    try {
      await widget.onRefresh();
      if (mounted && widget.refreshMessage != null) {
        setState(() {
          _lastRefreshMessage = widget.refreshMessage;
        });
        
        // Убираем сообщение через 2 секунды
        Future.delayed(const Duration(seconds: 2), () {
          if (mounted) {
            setState(() {
              _lastRefreshMessage = null;
            });
          }
        });
      }
    } finally {
      if (mounted) {
        setState(() {
          _isRefreshing = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        RefreshIndicator(
          onRefresh: _handleRefresh,
          color: Theme.of(context).primaryColor,
          child: widget.children.isEmpty && widget.emptyWidget != null
              ? SingleChildScrollView(
                  physics: const AlwaysScrollableScrollPhysics(),
                  child: SizedBox(
                    height: MediaQuery.of(context).size.height * 0.7,
                    child: Center(child: widget.emptyWidget),
                  ),
                )
              : ListView(
                  controller: widget.controller,
                  padding: widget.padding,
                  physics: const AlwaysScrollableScrollPhysics(),
                  children: widget.children,
                ),
        ),
        
        // Сообщение об обновлении
        if (_lastRefreshMessage != null)
          Positioned(
            top: 16,
            left: 0,
            right: 0,
            child: Center(
              child: Material(
                elevation: 4,
                borderRadius: BorderRadius.circular(20),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                  decoration: BoxDecoration(
                    color: Theme.of(context).primaryColor,
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.check_circle, color: Colors.white, size: 16),
                      const SizedBox(width: 8),
                      Text(
                        _lastRefreshMessage!,
                        style: const TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
      ],
    );
  }
}



