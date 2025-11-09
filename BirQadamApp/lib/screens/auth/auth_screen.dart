import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:animated_text_kit/animated_text_kit.dart';
import '../../l10n/app_localizations.dart';
import '../../providers/auth_provider.dart';
import '../../widgets/specialized/language_selector.dart';
import '../../widgets/common/birqadam_logo.dart';
import '../../widgets/specialized/animated_button.dart';

class AuthScreen extends StatefulWidget {
  const AuthScreen({super.key});

  @override
  State<AuthScreen> createState() => _AuthScreenState();
}

class _AuthScreenState extends State<AuthScreen> with TickerProviderStateMixin {
  bool _isLogin = true;
  bool _isLoading = false;
  String _selectedRole = 'volunteer';

  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();
  final _nameController = TextEditingController();
  final _phoneController = TextEditingController();
  final _organizationController = TextEditingController();

  late AnimationController _fadeController;
  late AnimationController _slideController;
  late Animation<double> _fadeAnimation;
  late Animation<Offset> _slideAnimation;

  @override
  void initState() {
    super.initState();

    _fadeController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 800),
    );

    _slideController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 600),
    );

    _fadeAnimation = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(parent: _fadeController, curve: Curves.easeIn),
    );

    _slideAnimation = Tween<Offset>(
      begin: const Offset(0, 0.3),
      end: Offset.zero,
    ).animate(CurvedAnimation(
      parent: _slideController,
      curve: Curves.easeOutCubic,
    ));

    _fadeController.forward();
    _slideController.forward();
  }

  @override
  void dispose() {
    _fadeController.dispose();
    _slideController.dispose();
    _emailController.dispose();
    _passwordController.dispose();
    _confirmPasswordController.dispose();
    _nameController.dispose();
    _phoneController.dispose();
    _organizationController.dispose();
    super.dispose();
  }

  void _toggleMode() {
    setState(() {
      _isLogin = !_isLogin;
      _slideController.reset();
      _slideController.forward();
    });
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) {
      return;
    }

    setState(() {
      _isLoading = true;
    });

    final authProvider = Provider.of<AuthProvider>(context, listen: false);

    try {
      if (_isLogin) {
        await authProvider.login(
          _emailController.text.trim(),
          _passwordController.text,
        );
      } else {
        await authProvider.register(
          _emailController.text.trim(),
          _passwordController.text,
          _nameController.text.trim(),
          _phoneController.text.trim(),
          _selectedRole,
          organizationName: _selectedRole == 'organizer' ? _organizationController.text.trim() : null,
        );
      }

      if (!mounted) return;

      if (authProvider.isAuthenticated) {
        final user = authProvider.user;
        
        // Навигация на основе роли и статуса
        if (user?.role == 'organizer' && !(user?.isApproved ?? false)) {
          // Организатор не одобрен - на экран ожидания
          Navigator.of(context).pushReplacementNamed('/pending-approval');
        } else if (user?.role == 'organizer') {
          // Организатор одобрен
          Navigator.of(context).pushReplacementNamed('/organizer');
        } else {
          // Волонтёр
          Navigator.of(context).pushReplacementNamed('/volunteer');
        }
      }
    } catch (error) {
      if (!mounted) return;

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(error.toString()),
          backgroundColor: Colors.red,
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(10),
          ),
        ),
      );
    } finally {
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final localizations = AppLocalizations.of(context)!;

    return Scaffold(
      body: Container(
        width: double.infinity,
        height: double.infinity,
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              Color(0xFF1976D2), // Синий
              Color(0xFF42A5F5), // Светло-синий
              Color(0xFF4CAF50), // Зеленый
              Color(0xFFFF9800), // Оранжевый
            ],
            stops: [0.0, 0.35, 0.65, 1.0],
          ),
        ),
        child: SafeArea(
          child: SingleChildScrollView(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 24.0),
              child: Column(
                children: [
                  const SizedBox(height: 20),

                  // Language selector
                  const Align(
                    alignment: Alignment.topRight,
                    child: LanguageSelector(),
                  ),

                  const SizedBox(height: 20),

                  // Logo and animated title
                  FadeTransition(
                    opacity: _fadeAnimation,
                    child: Column(
                      children: [
                        const BirQadamLogo(size: 100),
                        const SizedBox(height: 20),
                        AnimatedTextKit(
                          animatedTexts: [
                            TypewriterAnimatedText(
                              localizations.t('app_title'),
                              textStyle: const TextStyle(
                                fontSize: 32,
                                fontWeight: FontWeight.bold,
                                color: Colors.white,
                              ),
                              speed: const Duration(milliseconds: 100),
                            ),
                          ],
                          totalRepeatCount: 1,
                        ),
                      ],
                    ),
                  ),

                  const SizedBox(height: 40),

                  // Form card
                  SlideTransition(
                    position: _slideAnimation,
                    child: FadeTransition(
                      opacity: _fadeAnimation,
                      child: Container(
                        width: double.infinity,
                        padding: const EdgeInsets.all(28),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(32),
                          boxShadow: [
                            BoxShadow(
                              color: Colors.black.withValues(alpha: 0.15),
                              blurRadius: 40,
                              offset: const Offset(0, 20),
                              spreadRadius: 2,
                            ),
                          ],
                        ),
                        child: Form(
                          key: _formKey,
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              // Welcome text
                              Text(
                                _isLogin
                                    ? localizations.t('welcome_back')
                                    : localizations.t('join_us'),
                                style: const TextStyle(
                                  fontSize: 28,
                                  fontWeight: FontWeight.bold,
                                  color: Color(0xFF2D3436),
                                  letterSpacing: 0.5,
                                ),
                                textAlign: TextAlign.center,
                              ),
                              const SizedBox(height: 10),
                              Text(
                                _isLogin
                                    ? localizations.t('sign_in')
                                    : localizations.t('sign_up'),
                                style: TextStyle(
                                  fontSize: 15,
                                  color: Colors.grey[500],
                                  fontWeight: FontWeight.w500,
                                ),
                                textAlign: TextAlign.center,
                              ),
                              const SizedBox(height: 30),

                              // Name field (register only)
                              if (!_isLogin) ...[
                                _buildTextField(
                                  controller: _nameController,
                                  label: localizations.t('name'),
                                  hint: localizations.t('enter_name'),
                                  icon: Icons.person,
                                  validator: (value) {
                                    if (value == null || value.isEmpty) {
                                      return localizations.t('field_required');
                                    }
                                    return null;
                                  },
                                ),
                                const SizedBox(height: 16),
                              ],

                              // Phone field (register only)
                              if (!_isLogin) ...[
                                _buildTextField(
                                  controller: _phoneController,
                                  label: localizations.t('phone'),
                                  hint: localizations.t('enter_phone'),
                                  icon: Icons.phone,
                                  keyboardType: TextInputType.phone,
                                  validator: (value) {
                                    if (value == null || value.isEmpty) {
                                      return localizations.t('field_required');
                                    }
                                    return null;
                                  },
                                ),
                                const SizedBox(height: 16),
                              ],

                              // Organization name (only for organizers during registration)
                              if (!_isLogin && _selectedRole == 'organizer') ...[
                                _buildTextField(
                                  controller: _organizationController,
                                  label: 'Название организации',
                                  hint: 'Введите название вашей организации',
                                  icon: Icons.business,
                                  validator: (value) {
                                    if (value == null || value.isEmpty) {
                                      return localizations.t('field_required');
                                    }
                                    return null;
                                  },
                                ),
                                const SizedBox(height: 16),
                              ],

                              // Email field
                              _buildTextField(
                                controller: _emailController,
                                label: localizations.t('email'),
                                hint: localizations.t('enter_email'),
                                icon: Icons.email,
                                keyboardType: TextInputType.emailAddress,
                                validator: (value) {
                                  if (value == null || value.isEmpty) {
                                    return localizations.t('field_required');
                                  }
                                  if (!value.contains('@')) {
                                    return localizations.t('invalid_email');
                                  }
                                  return null;
                                },
                              ),
                              const SizedBox(height: 16),

                              // Password field
                              _buildTextField(
                                controller: _passwordController,
                                label: localizations.t('password'),
                                hint: localizations.t('enter_password'),
                                icon: Icons.lock,
                                isPassword: true,
                                validator: (value) {
                                  if (value == null || value.isEmpty) {
                                    return localizations.t('field_required');
                                  }
                                  if (value.length < 6) {
                                    return localizations.t('password_min_length');
                                  }
                                  return null;
                                },
                              ),
                              const SizedBox(height: 16),

                              // Confirm password (register only)
                              if (!_isLogin) ...[
                                _buildTextField(
                                  controller: _confirmPasswordController,
                                  label: localizations.t('confirm_password'),
                                  hint: localizations.t('confirm_password'),
                                  icon: Icons.lock_outline,
                                  isPassword: true,
                                  validator: (value) {
                                    if (value == null || value.isEmpty) {
                                      return localizations.t('field_required');
                                    }
                                    if (value != _passwordController.text) {
                                      return localizations.t('passwords_dont_match');
                                    }
                                    return null;
                                  },
                                ),
                                const SizedBox(height: 20),

                                // Role selector
                                Text(
                                  localizations.t('select_role'),
                                  style: const TextStyle(
                                    fontSize: 18,
                                    fontWeight: FontWeight.bold,
                                    color: Color(0xFF2D3436),
                                  ),
                                ),
                                const SizedBox(height: 12),
                                Row(
                                  children: [
                                    Expanded(
                                      child: _buildRoleCard(
                                        'volunteer',
                                        Icons.volunteer_activism,
                                        localizations.t('volunteer'),
                                        const Color(0xFFE91E63),
                                      ),
                                    ),
                                    const SizedBox(width: 12),
                                    Expanded(
                                      child: _buildRoleCard(
                                        'organizer',
                                        Icons.business_center,
                                        localizations.t('organizer'),
                                        const Color(0xFF9C27B0),
                                      ),
                                    ),
                                  ],
                                ),
                              ],

                              const SizedBox(height: 30),

                              // Submit button
                              Container(
                                height: 58,
                                decoration: BoxDecoration(
                                  gradient: const LinearGradient(
                                    colors: [Color(0xFF1976D2), Color(0xFF42A5F5)],
                                    begin: Alignment.centerLeft,
                                    end: Alignment.centerRight,
                                  ),
                                  borderRadius: BorderRadius.circular(16),
                                  boxShadow: [
                                    BoxShadow(
                                      color: const Color(0xFF1976D2).withValues(alpha: 0.4),
                                      blurRadius: 15,
                                      offset: const Offset(0, 8),
                                    ),
                                  ],
                                ),
                                child: AnimatedButton(
                                  text: _isLogin
                                      ? localizations.t('sign_in')
                                      : localizations.t('sign_up'),
                                  icon: _isLogin ? Icons.login_rounded : Icons.person_add_rounded,
                                  onPressed: _submit,
                                  isLoading: _isLoading,
                                  isFullWidth: true,
                                  backgroundColor: Colors.transparent,
                                ),
                              ),

                              const SizedBox(height: 20),

                              // Toggle mode button
                              TextButton(
                                onPressed: _toggleMode,
                                style: TextButton.styleFrom(
                                  padding: const EdgeInsets.symmetric(vertical: 12),
                                ),
                                child: RichText(
                                  text: TextSpan(
                                    text: _isLogin
                                        ? localizations.t('dont_have_account') + ' '
                                        : localizations.t('already_have_account') + ' ',
                                    style: TextStyle(
                                      color: Colors.grey[600],
                                      fontSize: 15,
                                      fontWeight: FontWeight.w500,
                                    ),
                                    children: [
                                      TextSpan(
                                        text: _isLogin
                                            ? localizations.t('sign_up')
                                            : localizations.t('sign_in'),
                                        style: const TextStyle(
                                          color: Color(0xFF1976D2),
                                          fontWeight: FontWeight.bold,
                                          decoration: TextDecoration.underline,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ),

                  const SizedBox(height: 30),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildTextField({
    required TextEditingController controller,
    required String label,
    required String hint,
    required IconData icon,
    bool isPassword = false,
    TextInputType? keyboardType,
    String? Function(String?)? validator,
  }) {
    return TextFormField(
      controller: controller,
      obscureText: isPassword,
      keyboardType: keyboardType,
      validator: validator,
      style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w500),
      decoration: InputDecoration(
        labelText: label,
        hintText: hint,
        prefixIcon: Container(
          margin: const EdgeInsets.all(10),
          padding: const EdgeInsets.all(8),
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              colors: [Color(0xFF1976D2), Color(0xFF42A5F5)],
            ),
            borderRadius: BorderRadius.circular(10),
          ),
          child: Icon(icon, color: Colors.white, size: 20),
        ),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: BorderSide(color: Colors.grey[300]!),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: BorderSide(color: Colors.grey[300]!),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: const BorderSide(color: Color(0xFF1976D2), width: 2),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: const BorderSide(color: Colors.red),
        ),
        filled: true,
        fillColor: const Color(0xFFF8F9FA),
        contentPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 18),
      ),
    );
  }

  Widget _buildRoleCard(String role, IconData icon, String label, Color color) {
    final isSelected = _selectedRole == role;

    return GestureDetector(
      onTap: () {
        setState(() {
          _selectedRole = role;
        });
      },
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 300),
        curve: Curves.easeInOut,
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          gradient: isSelected
              ? LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [color, color.withValues(alpha: 0.8)],
                )
              : null,
          color: isSelected ? null : const Color(0xFFF8F9FA),
          border: Border.all(
            color: isSelected ? Colors.white.withValues(alpha: 0.5) : Colors.grey[300]!,
            width: isSelected ? 2 : 1.5,
          ),
          borderRadius: BorderRadius.circular(20),
          boxShadow: isSelected
              ? [
                  BoxShadow(
                    color: color.withValues(alpha: 0.4),
                    blurRadius: 12,
                    offset: const Offset(0, 6),
                  ),
                ]
              : [],
        ),
        child: Column(
          children: [
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: isSelected ? Colors.white.withValues(alpha: 0.25) : color.withValues(alpha: 0.15),
                shape: BoxShape.circle,
              ),
              child: Icon(
                icon,
                color: isSelected ? Colors.white : color,
                size: 36,
              ),
            ),
            const SizedBox(height: 12),
            Text(
              label,
              style: TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.bold,
                color: isSelected ? Colors.white : Colors.grey[700],
              ),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }
}
