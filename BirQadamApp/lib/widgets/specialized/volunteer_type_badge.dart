import 'package:flutter/material.dart';

enum VolunteerType {
  social,
  environmental,
  cultural;

  String get label {
    switch (this) {
      case VolunteerType.social:
        return 'Социальная помощь';
      case VolunteerType.environmental:
        return 'Экологические проекты';
      case VolunteerType.cultural:
        return 'Культурные мероприятия';
    }
  }

  IconData get icon {
    switch (this) {
      case VolunteerType.social:
        return Icons.volunteer_activism;
      case VolunteerType.environmental:
        return Icons.eco;
      case VolunteerType.cultural:
        return Icons.theater_comedy;
    }
  }

  Color get color {
    switch (this) {
      case VolunteerType.social:
        return const Color(0xFFE91E63); // Pink
      case VolunteerType.environmental:
        return const Color(0xFF4CAF50); // Green
      case VolunteerType.cultural:
        return const Color(0xFF9C27B0); // Purple
    }
  }

  static VolunteerType fromString(String value) {
    switch (value) {
      case 'social':
        return VolunteerType.social;
      case 'environmental':
        return VolunteerType.environmental;
      case 'cultural':
        return VolunteerType.cultural;
      default:
        return VolunteerType.environmental;
    }
  }
}

class VolunteerTypeBadge extends StatelessWidget {
  final String volunteerTypeString;
  final bool showLabel;
  final double size;

  const VolunteerTypeBadge({
    super.key,
    required this.volunteerTypeString,
    this.showLabel = true,
    this.size = 32,
  });

  @override
  Widget build(BuildContext context) {
    final type = VolunteerType.fromString(volunteerTypeString);

    if (!showLabel) {
      return Container(
        padding: EdgeInsets.all(size / 8),
        decoration: BoxDecoration(
          color: type.color.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(size / 4),
        ),
        child: Icon(
          type.icon,
          color: type.color,
          size: size,
        ),
      );
    }

    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: size / 2,
        vertical: size / 4,
      ),
      decoration: BoxDecoration(
        color: type.color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(size / 2),
        border: Border.all(
          color: type.color.withValues(alpha: 0.3),
          width: 1,
        ),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            type.icon,
            color: type.color,
            size: size * 0.6,
          ),
          SizedBox(width: size / 4),
          Text(
            type.label,
            style: TextStyle(
              color: type.color,
              fontSize: size * 0.4,
              fontWeight: FontWeight.w500,
            ),
          ),
        ],
      ),
    );
  }
}
