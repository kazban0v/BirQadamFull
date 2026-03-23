class UserModel {
  final int id;
  final String username;
  final String email;
  final String? name;
  final String role;
  final bool isOrganizer;
  final bool isApproved;
  final bool isRejected; // Добавлено поле для отклонения
  final int rating;
  final String? registrationSource;

  UserModel({
    required this.id,
    required this.username,
    required this.email,
    this.name,
    required this.role,
    required this.isOrganizer,
    required this.isApproved,
    required this.isRejected,
    required this.rating,
    this.registrationSource,
  });

  factory UserModel.fromJson(Map<String, dynamic> json) {
    return UserModel(
      id: json['id'] ?? json['user_id'] ?? 0,
      username: json['username'] ?? '',
      email: json['email'] ?? '',
      name: json['name'],
      role: json['role'] ?? 'volunteer',
      isOrganizer: json['is_organizer'] ?? false,
      isApproved: json['is_approved'] ?? (json['role'] == 'volunteer' ? true : false),
      isRejected: json['is_rejected'] ?? false,
      rating: json['rating'] ?? 0,
      registrationSource: json['registration_source'],
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'username': username,
      'email': email,
      'name': name,
      'role': role,
      'is_organizer': isOrganizer,
      'is_approved': isApproved,
      'is_rejected': isRejected,
      'rating': rating,
      'registration_source': registrationSource,
    };
  }

  UserModel copyWith({
    int? id,
    String? username,
    String? email,
    String? name,
    String? role,
    bool? isOrganizer,
    bool? isApproved,
    bool? isRejected,
    int? rating,
    String? registrationSource,
  }) {
    return UserModel(
      id: id ?? this.id,
      username: username ?? this.username,
      email: email ?? this.email,
      name: name ?? this.name,
      role: role ?? this.role,
      isOrganizer: isOrganizer ?? this.isOrganizer,
      isApproved: isApproved ?? this.isApproved,
      isRejected: isRejected ?? this.isRejected,
      rating: rating ?? this.rating,
      registrationSource: registrationSource ?? this.registrationSource,
    );
  }
}
