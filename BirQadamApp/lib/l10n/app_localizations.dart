import 'package:flutter/material.dart';

class AppLocalizations {
  final Locale locale;

  AppLocalizations(this.locale);

  static AppLocalizations? of(BuildContext context) {
    return Localizations.of<AppLocalizations>(context, AppLocalizations);
  }

  static const LocalizationsDelegate<AppLocalizations> delegate =
      _AppLocalizationsDelegate();

  static const List<Locale> supportedLocales = [
    Locale('ru', 'RU'),
    Locale('kk', 'KZ'),
    Locale('en', 'US'),
  ];

  static final Map<String, Map<String, String>> _localizedValues = {
    'ru': {
      // Common
      'app_title': 'BirQadam',
      'save': 'Сохранить',
      'cancel': 'Отмена',
      'confirm': 'Подтвердить',
      'delete': 'Удалить',
      'edit': 'Редактировать',
      'loading': 'Загрузка...',
      'error': 'Ошибка',
      'success': 'Успешно',
      'ok': 'ОК',
      'back': 'Назад',
      'next': 'Далее',
      'select_language': 'Выберите язык',
      'russian': 'Русский',
      'kazakh': 'Қазақша',
      'english': 'English',
      'you': 'Вы',
      'volunteers': 'Волонтеры',
      'cities': 'Города',
      'achievements': 'Достижения',

      // Auth
      'login': 'Вход',
      'register': 'Регистрация',
      'email': 'Email',
      'password': 'Пароль',
      'name': 'Имя',
      'phone': 'Телефон',
      'confirm_password': 'Подтвердите пароль',
      'forgot_password': 'Забыли пароль?',
      'dont_have_account': 'Нет аккаунта?',
      'already_have_account': 'Уже есть аккаунт?',
      'sign_in': 'Войти',
      'sign_up': 'Зарегистрироваться',
      'logout': 'Выйти',
      'select_role': 'Выберите роль',
      'volunteer': 'Волонтер',
      'organizer': 'Организатор',
      'welcome_back': 'С возвращением!',
      'join_us': 'Присоединяйтесь к нам',
      'enter_email': 'Введите email',
      'enter_password': 'Введите пароль',
      'enter_name': 'Введите имя',
      'enter_phone': 'Введите номер телефона',
      'password_min_length': 'Пароль должен содержать минимум 6 символов',
      'passwords_dont_match': 'Пароли не совпадают',
      'invalid_email': 'Неверный формат email',
      'field_required': 'Это поле обязательно',

      // Organizer approval
      'awaiting_approval': 'Ожидание одобрения',
      'approval_pending': 'Ваша заявка на рассмотрении',
      'approval_pending_desc': 'Администратор проверит вашу заявку и уведомит вас о результате. Обычно это занимает 1-2 рабочих дня.',
      'check_back_later': 'Проверьте позже',
      'contact_admin': 'Связаться с администратором',
      'approval_rejected': 'Заявка отклонена',
      'approval_rejected_desc': 'К сожалению, ваша заявка была отклонена. Свяжитесь с администратором для получения дополнительной информации.',

      // Projects
      'projects': 'Проекты',
      'my_projects': 'Мои проекты',
      'all_projects': 'Все проекты',
      'create_project': 'Создать проект',
      'project_title': 'Название проекта',
      'project_description': 'Описание проекта',
      'project_city': 'Город',
      'project_date': 'Дата проекта',
      'start_date': 'Дата начала',
      'end_date': 'Дата окончания',
      'volunteers_needed': 'Нужно волонтеров',
      'volunteers_joined': 'Присоединилось волонтеров',
      'join_project': 'Присоединиться',
      'leave_project': 'Покинуть проект',
      'project_details': 'Детали проекта',
      'no_projects': 'Нет проектов',
      'no_projects_desc': 'Создайте свой первый проект или присоединитесь к существующим',

      // Volunteer types
      'volunteer_type': 'Тип волонтерства',
      'social': 'Социальная помощь',
      'environmental': 'Экологические проекты',
      'cultural': 'Культурные мероприятия',

      // Tasks
      'tasks': 'Задачи',
      'my_tasks': 'Мои задачи',
      'create_task': 'Создать задачу',
      'task_title': 'Название задачи',
      'task_description': 'Описание задачи',
      'task_deadline': 'Срок выполнения',
      'task_status': 'Статус',
      'task_completed': 'Завершена',
      'task_pending': 'В ожидании',
      'task_in_progress': 'В процессе',
      'no_tasks': 'Нет задач',
      'assign_task': 'Назначить задачу',

      // Profile
      'profile': 'Профиль',
      'edit_profile': 'Редактировать профиль',
      'change_password': 'Изменить пароль',
      'settings': 'Настройки',
      'notifications': 'Уведомления',
      'language': 'Язык',
      'rating': 'Рейтинг',
      'projects_completed': 'Завершено проектов',
      'tasks_completed': 'Завершено задач',

      // Participants
      'participants': 'Участники',
      'add_participant': 'Добавить участника',
      'remove_participant': 'Удалить участника',
      'no_participants': 'Нет участников',

      // ✅ ИСПРАВЛЕНИЕ НП-6: Дополнительные переводы
      // Theme
      'theme': 'Тема',
      'light_theme': 'Светлая тема',
      'dark_theme': 'Темная тема',
      'system_theme': 'Системная',
      
      // Statistics
      'statistics': 'Статистика',
      'total_projects': 'Всего проектов',
      'active_projects': 'Активные проекты',
      'total_volunteers': 'Всего волонтёров',
      'hours_volunteered': 'Часов волонтёрства',
      
      // Photo Reports
      'photo_reports': 'Фотоотчёты',
      'upload_photo': 'Загрузить фото',
      'take_photo': 'Сделать фото',
      'select_from_gallery': 'Выбрать из галереи',
      'photo_uploaded': 'Фото загружено',
      'photo_approved': 'Фото одобрено',
      'photo_rejected': 'Фото отклонено',
      
      // Actions
      'accept': 'Принять',
      'decline': 'Отклонить',
      'approve': 'Одобрить',
      'reject': 'Отклонить',
      'submit': 'Отправить',
      'close': 'Закрыть',
      'refresh': 'Обновить',
      'share': 'Поделиться',
      'download': 'Скачать',
      
      // Time
      'today': 'Сегодня',
      'yesterday': 'Вчера',
      'tomorrow': 'Завтра',
      'this_week': 'На этой неделе',
      'this_month': 'В этом месяце',
      'last_week': 'На прошлой неделе',
      'last_month': 'В прошлом месяце',
      
      // Search & Filter
      'search': 'Поиск',
      'filter': 'Фильтр',
      'sort_by': 'Сортировка',
      'all': 'Все',
      'completed': 'Завершённые',
      'in_progress': 'В процессе',
      'upcoming': 'Предстоящие',

      // Errors
      'error_occurred': 'Произошла ошибка',
      'network_error': 'Ошибка сети',
      'server_error': 'Ошибка сервера',
      'try_again': 'Попробуйте снова',
      'invalid_credentials': 'Неверный email или пароль',

      // Onboarding
      'onboarding_skip': 'Пропустить',
      'onboarding_get_started': 'Начать',
      'onboarding_welcome_title': 'Добро пожаловать в BirQadam',
      'onboarding_welcome_subtitle': 'Один шаг к лучшему миру',
      'onboarding_welcome_desc': 'Присоединяйтесь к сообществу волонтёров и организаторов социальных проектов',

      'onboarding_account_title': 'Проверяем аккаунт',
      'onboarding_account_subtitle': 'У вас ещё нет учётной записи в BirQadam?',
      'onboarding_account_desc': 'Перенаправляем вас на\nстраницу авторизации\nи регистрации',

      'onboarding_registration_title': 'Регистрация завершена',
      'onboarding_registration_subtitle': 'Ваша заявка одобрена!',
      'onboarding_registration_desc': 'Теперь давайте настроим уведомления',
      'onboarding_enable_notifications': 'Включить уведомления',
      'onboarding_notifications_enabled': 'Уведомления включены!',
      'onboarding_notifications_title': 'Будьте в курсе',
      'onboarding_notifications_desc': 'Получайте информацию о новых проектах и задачах',

      // Notification examples
      'onboarding_notif_registration': 'Регистрация завершена',
      'onboarding_notif_registration_desc': 'Добро пожаловать в BirQadam!',
      'onboarding_notif_checkin': 'Напоминание о регистрации',
      'onboarding_notif_checkin_desc': 'Не забудьте отметиться на смене',
      'onboarding_notif_role': 'Новая роль предложена',
      'onboarding_notif_role_desc': 'Вам предложена роль координатора',

      'onboarding_location_title': 'Разрешить доступ к геолокации',
      'onboarding_location_subtitle': 'Поделитесь своим местоположением для лучшего опыта',
      'onboarding_location_desc': 'Это поможет вам:',
      'onboarding_location_benefit1': 'Проекты рядом с вами',
      'onboarding_location_benefit2': 'Навигация до места',
      'onboarding_location_benefit3': 'Уведомления о событиях',
      'onboarding_enable_location': 'Разрешить доступ',
      'onboarding_skip_location': 'Пропустить',
      'onboarding_location_enabled': 'Доступ к геолокации разрешён!',

      'onboarding_final_title': 'Добро пожаловать в сообщество BirQadam',
      'onboarding_final_subtitle': 'Вы готовы начать!',
      'onboarding_final_desc': 'Здесь вы можете:',
      'onboarding_final_benefit1': 'Открыть для себя новые\nвозможности волонтёрства',
      'onboarding_final_benefit2': 'Поддержать дела, которые\nвам важны',
      'onboarding_final_benefit3': 'Стать частью глобального\nсообщества',
      'onboarding_lets_start': 'Давайте начнём!',

      'onboarding_community_title': 'Присоединяйтесь к нашему сообществу',
      'onboarding_community_desc': 'Станьте частью команды волонтеров по всему Казахстану',
    },
    'kk': {
      // Common
      'app_title': 'BirQadam',
      'save': 'Сақтау',
      'cancel': 'Болдырмау',
      'confirm': 'Растау',
      'delete': 'Жою',
      'edit': 'Өңдеу',
      'loading': 'Жүктелуде...',
      'error': 'Қате',
      'success': 'Сәтті',
      'ok': 'Жарайды',
      'back': 'Артқа',
      'next': 'Алға',
      'select_language': 'Тілді таңдаңыз',
      'russian': 'Русский',
      'kazakh': 'Қазақша',
      'english': 'English',
      'you': 'Сіз',
      'volunteers': 'Волонтерлер',
      'cities': 'Қалалар',
      'achievements': 'Жетістіктер',

      // Auth
      'login': 'Кіру',
      'register': 'Тіркелу',
      'email': 'Email',
      'password': 'Құпия сөз',
      'name': 'Аты',
      'phone': 'Телефон',
      'confirm_password': 'Құпия сөзді растаңыз',
      'forgot_password': 'Құпия сөзді ұмыттыңыз ба?',
      'dont_have_account': 'Аккаунт жоқ па?',
      'already_have_account': 'Аккаунт бар ма?',
      'sign_in': 'Кіру',
      'sign_up': 'Тіркелу',
      'logout': 'Шығу',
      'select_role': 'Рөлді таңдаңыз',
      'volunteer': 'Волонтер',
      'organizer': 'Ұйымдастырушы',
      'welcome_back': 'Қайта оралуыңызбен!',
      'join_us': 'Бізге қосылыңыз',
      'enter_email': 'Email енгізіңіз',
      'enter_password': 'Құпия сөзді енгізіңіз',
      'enter_name': 'Атыңызды енгізіңіз',
      'enter_phone': 'Телефон нөмірін енгізіңіз',
      'password_min_length': 'Құпия сөз кемінде 6 таңбадан тұруы керек',
      'passwords_dont_match': 'Құпия сөздер сәйкес келмейді',
      'invalid_email': 'Email форматы дұрыс емес',
      'field_required': 'Бұл өріс міндетті',

      // Organizer approval
      'awaiting_approval': 'Мақұлдауды күту',
      'approval_pending': 'Сіздің өтінішіңіз қарастырылуда',
      'approval_pending_desc': 'Әкімші сіздің өтінішіңізді тексереді және нәтижесі туралы хабарлайды. Әдетте бұл 1-2 жұмыс күнін алады.',
      'check_back_later': 'Кейінірек тексеріңіз',
      'contact_admin': 'Әкіммен байланысу',
      'approval_rejected': 'Өтініш қабылданбады',
      'approval_rejected_desc': 'Өкінішке орай, сіздің өтінішіңіз қабылданбады. Қосымша ақпарат алу үшін әкіммен байланысыңыз.',

      // Projects
      'projects': 'Жобалар',
      'my_projects': 'Менің жобаларым',
      'all_projects': 'Барлық жобалар',
      'create_project': 'Жоба жасау',
      'project_title': 'Жоба атауы',
      'project_description': 'Жоба сипаттамасы',
      'project_city': 'Қала',
      'project_date': 'Жоба күні',
      'start_date': 'Басталу күні',
      'end_date': 'Аяқталу күні',
      'volunteers_needed': 'Волонтерлер қажет',
      'volunteers_joined': 'Волонтерлер қосылды',
      'join_project': 'Қосылу',
      'leave_project': 'Жобадан шығу',
      'project_details': 'Жоба мәліметтері',
      'no_projects': 'Жобалар жоқ',
      'no_projects_desc': 'Алғашқы жобаңызды жасаңыз немесе бар жобаларға қосылыңыз',

      // Volunteer types
      'volunteer_type': 'Волонтерлік түрі',
      'social': 'Әлеуметтік көмек',
      'environmental': 'Экологиялық жобалар',
      'cultural': 'Мәдени іс-шаралар',

      // Tasks
      'tasks': 'Тапсырмалар',
      'my_tasks': 'Менің тапсырмаларым',
      'create_task': 'Тапсырма жасау',
      'task_title': 'Тапсырма атауы',
      'task_description': 'Тапсырма сипаттамасы',
      'task_deadline': 'Орындау мерзімі',
      'task_status': 'Күй',
      'task_completed': 'Аяқталды',
      'task_pending': 'Күтуде',
      'task_in_progress': 'Орындалуда',
      'no_tasks': 'Тапсырмалар жоқ',
      'assign_task': 'Тапсырма тағайындау',

      // Profile
      'profile': 'Профиль',
      'edit_profile': 'Профильді өңдеу',
      'change_password': 'Құпия сөзді өзгерту',
      'settings': 'Баптаулар',
      'notifications': 'Хабарландырулар',
      'language': 'Тіл',
      'rating': 'Рейтинг',
      'projects_completed': 'Аяқталған жобалар',
      'tasks_completed': 'Аяқталған тапсырмалар',

      // Participants
      'participants': 'Қатысушылар',
      'add_participant': 'Қатысушы қосу',
      'remove_participant': 'Қатысушыны жою',
      'no_participants': 'Қатысушылар жоқ',

      // ✅ ИСПРАВЛЕНИЕ НП-6: Дополнительные переводы
      // Theme
      'theme': 'Тақырып',
      'light_theme': 'Жарық тақырып',
      'dark_theme': 'Қараңғы тақырып',
      'system_theme': 'Жүйе бойынша',
      
      // Statistics
      'statistics': 'Статистика',
      'total_projects': 'Барлығы жобалар',
      'active_projects': 'Белсенді жобалар',
      'total_volunteers': 'Барлығы волонтерлер',
      'hours_volunteered': 'Волонтерлік сағаттар',
      
      // Photo Reports
      'photo_reports': 'Фото есептер',
      'upload_photo': 'Фото жүктеу',
      'take_photo': 'Фото түсіру',
      'select_from_gallery': 'Галереядан таңдау',
      'photo_uploaded': 'Фото жүктелді',
      'photo_approved': 'Фото мақұлданды',
      'photo_rejected': 'Фото қабылданбады',
      
      // Actions
      'accept': 'Қабылдау',
      'decline': 'Бас тарту',
      'approve': 'Мақұлдау',
      'reject': 'Қабылдамау',
      'submit': 'Жіберу',
      'close': 'Жабу',
      'refresh': 'Жаңарту',
      'share': 'Бөлісу',
      'download': 'Жүктеп алу',
      
      // Time
      'today': 'Бүгін',
      'yesterday': 'Кеше',
      'tomorrow': 'Ертең',
      'this_week': 'Осы апта',
      'this_month': 'Осы ай',
      'last_week': 'Өткен апта',
      'last_month': 'Өткен ай',
      
      // Search & Filter
      'search': 'Іздеу',
      'filter': 'Сүзгі',
      'sort_by': 'Сұрыптау',
      'all': 'Барлығы',
      'completed': 'Аяқталды',
      'in_progress': 'Орындалуда',
      'upcoming': 'Алдағы',

      // Errors
      'error_occurred': 'Қате пайда болды',
      'network_error': 'Желі қатесі',
      'server_error': 'Сервер қатесі',
      'try_again': 'Қайталап көріңіз',
      'invalid_credentials': 'Email немесе құпия сөз дұрыс емес',

      // Onboarding
      'onboarding_skip': 'Өткізу',
      'onboarding_get_started': 'Бастау',
      'onboarding_welcome_title': 'BirQadam-ға қош келдіңіз',
      'onboarding_welcome_subtitle': 'Жақсы әлемге бір қадам',
      'onboarding_welcome_desc': 'Волонтерлер мен әлеуметтік жобалар ұйымдастырушыларының қауымдастығына қосылыңыз',

      'onboarding_account_title': 'Аккаунтты тексеріп жатырмыз',
      'onboarding_account_subtitle': 'BirQadam-да әлі есептік жазбаңыз жоқ па?',
      'onboarding_account_desc': 'Сізді авторизация және\nтіркеу бетіне\nбағыттаймыз',

      'onboarding_registration_title': 'Тіркеу аяқталды',
      'onboarding_registration_subtitle': 'Сіздің өтінішіңіз мақұлданды!',
      'onboarding_registration_desc': 'Енді хабарландыруларды баптайық',
      'onboarding_enable_notifications': 'Хабарландыруларды қосу',
      'onboarding_notifications_enabled': 'Хабарландырулар қосылды!',
      'onboarding_notifications_title': 'Хабардар болыңыз',
      'onboarding_notifications_desc': 'Жаңа жобалар мен тапсырмалар туралы ақпарат алыңыз',

      // Notification examples
      'onboarding_notif_registration': 'Тіркеу аяқталды',
      'onboarding_notif_registration_desc': 'BirQadam-ға қош келдіңіз!',
      'onboarding_notif_checkin': 'Тіркелу туралы еске салу',
      'onboarding_notif_checkin_desc': 'Жұмыс кезінде белгілеуді ұмытпаңыз',
      'onboarding_notif_role': 'Жаңа рөл ұсынылды',
      'onboarding_notif_role_desc': 'Сізге үйлестіруші рөлі ұсынылды',

      'onboarding_location_title': 'Геолокацияға рұқсат беру',
      'onboarding_location_subtitle': 'Жақсырақ тәжірибе үшін орналасқан жеріңізбен бөлісіңіз',
      'onboarding_location_desc': 'Бұл сізге көмектеседі:',
      'onboarding_location_benefit1': 'Жаныңыздағы жобалар',
      'onboarding_location_benefit2': 'Орынға навигация',
      'onboarding_location_benefit3': 'Оқиғалар туралы хабарландырулар',
      'onboarding_enable_location': 'Рұқсат беру',
      'onboarding_skip_location': 'Өткізу',
      'onboarding_location_enabled': 'Геолокацияға рұқсат берілді!',

      'onboarding_final_title': 'BirQadam қауымдастығына қош келдіңіз',
      'onboarding_final_subtitle': 'Сіз бастауға дайынсыз!',
      'onboarding_final_desc': 'Мұнда сіз:',
      'onboarding_final_benefit1': 'Волонтерліктің жаңа\nмүмкіндіктерін ашасыз',
      'onboarding_final_benefit2': 'Сізге маңызды істерді\nқолдайсыз',
      'onboarding_final_benefit3': 'Жаһандық қауымдастықтың\nбөлігі боласыз',
      'onboarding_lets_start': 'Бастайық!',

      'onboarding_community_title': 'Біздің қауымдастыққа қосылыңыз',
      'onboarding_community_desc': 'Қазақстан бойынша волонтерлер тобының бөлігі болыңыз',
    },
    'en': {
      // Common
      'app_title': 'BirQadam',
      'save': 'Save',
      'cancel': 'Cancel',
      'confirm': 'Confirm',
      'delete': 'Delete',
      'edit': 'Edit',
      'loading': 'Loading...',
      'error': 'Error',
      'success': 'Success',
      'ok': 'OK',
      'back': 'Back',
      'next': 'Next',
      'select_language': 'Select language',
      'russian': 'Русский',
      'kazakh': 'Қазақша',
      'english': 'English',
      'you': 'You',
      'volunteers': 'Volunteers',
      'cities': 'Cities',
      'achievements': 'Achievements',

      // Auth
      'login': 'Login',
      'register': 'Register',
      'email': 'Email',
      'password': 'Password',
      'name': 'Name',
      'phone': 'Phone',
      'confirm_password': 'Confirm password',
      'forgot_password': 'Forgot password?',
      'dont_have_account': 'Don\'t have an account?',
      'already_have_account': 'Already have an account?',
      'sign_in': 'Sign in',
      'sign_up': 'Sign up',
      'logout': 'Logout',
      'select_role': 'Select role',
      'volunteer': 'Volunteer',
      'organizer': 'Organizer',
      'welcome_back': 'Welcome back!',
      'join_us': 'Join us',
      'enter_email': 'Enter email',
      'enter_password': 'Enter password',
      'enter_name': 'Enter name',
      'enter_phone': 'Enter phone number',
      'password_min_length': 'Password must be at least 6 characters',
      'passwords_dont_match': 'Passwords don\'t match',
      'invalid_email': 'Invalid email format',
      'field_required': 'This field is required',

      // Organizer approval
      'awaiting_approval': 'Awaiting approval',
      'approval_pending': 'Your application is under review',
      'approval_pending_desc': 'The administrator will review your application and notify you of the result. This usually takes 1-2 business days.',
      'check_back_later': 'Check back later',
      'contact_admin': 'Contact administrator',
      'approval_rejected': 'Application rejected',
      'approval_rejected_desc': 'Unfortunately, your application was rejected. Contact the administrator for more information.',

      // Projects
      'projects': 'Projects',
      'my_projects': 'My projects',
      'all_projects': 'All projects',
      'create_project': 'Create project',
      'project_title': 'Project title',
      'project_description': 'Project description',
      'project_city': 'City',
      'project_date': 'Project date',
      'start_date': 'Start date',
      'end_date': 'End date',
      'volunteers_needed': 'Volunteers needed',
      'volunteers_joined': 'Volunteers joined',
      'join_project': 'Join',
      'leave_project': 'Leave project',
      'project_details': 'Project details',
      'no_projects': 'No projects',
      'no_projects_desc': 'Create your first project or join existing ones',

      // Volunteer types
      'volunteer_type': 'Volunteer type',
      'social': 'Social assistance',
      'environmental': 'Environmental projects',
      'cultural': 'Cultural events',

      // Tasks
      'tasks': 'Tasks',
      'my_tasks': 'My tasks',
      'create_task': 'Create task',
      'task_title': 'Task title',
      'task_description': 'Task description',
      'task_deadline': 'Deadline',
      'task_status': 'Status',
      'task_completed': 'Completed',
      'task_pending': 'Pending',
      'task_in_progress': 'In progress',
      'no_tasks': 'No tasks',
      'assign_task': 'Assign task',

      // Profile
      'profile': 'Profile',
      'edit_profile': 'Edit profile',
      'change_password': 'Change password',
      'settings': 'Settings',
      'notifications': 'Notifications',
      'language': 'Language',
      'rating': 'Rating',
      'projects_completed': 'Projects completed',
      'tasks_completed': 'Tasks completed',

      // Participants
      'participants': 'Participants',
      'add_participant': 'Add participant',
      'remove_participant': 'Remove participant',
      'no_participants': 'No participants',

      // ✅ ИСПРАВЛЕНИЕ НП-6: Additional translations
      // Theme
      'theme': 'Theme',
      'light_theme': 'Light theme',
      'dark_theme': 'Dark theme',
      'system_theme': 'System default',
      
      // Statistics
      'statistics': 'Statistics',
      'total_projects': 'Total projects',
      'active_projects': 'Active projects',
      'total_volunteers': 'Total volunteers',
      'hours_volunteered': 'Hours volunteered',
      
      // Photo Reports
      'photo_reports': 'Photo reports',
      'upload_photo': 'Upload photo',
      'take_photo': 'Take photo',
      'select_from_gallery': 'Select from gallery',
      'photo_uploaded': 'Photo uploaded',
      'photo_approved': 'Photo approved',
      'photo_rejected': 'Photo rejected',
      
      // Actions
      'accept': 'Accept',
      'decline': 'Decline',
      'approve': 'Approve',
      'reject': 'Reject',
      'submit': 'Submit',
      'close': 'Close',
      'refresh': 'Refresh',
      'share': 'Share',
      'download': 'Download',
      
      // Time
      'today': 'Today',
      'yesterday': 'Yesterday',
      'tomorrow': 'Tomorrow',
      'this_week': 'This week',
      'this_month': 'This month',
      'last_week': 'Last week',
      'last_month': 'Last month',
      
      // Search & Filter
      'search': 'Search',
      'filter': 'Filter',
      'sort_by': 'Sort by',
      'all': 'All',
      'completed': 'Completed',
      'in_progress': 'In progress',
      'upcoming': 'Upcoming',

      // Errors
      'error_occurred': 'An error occurred',
      'network_error': 'Network error',
      'server_error': 'Server error',
      'try_again': 'Try again',
      'invalid_credentials': 'Invalid email or password',

      // Onboarding
      'onboarding_skip': 'Skip',
      'onboarding_get_started': 'Get started',
      'onboarding_welcome_title': 'Welcome to BirQadam',
      'onboarding_welcome_subtitle': 'One step towards a better world',
      'onboarding_welcome_desc': 'Join the community of volunteers and social project organizers',

      'onboarding_account_title': 'Checking account',
      'onboarding_account_subtitle': 'Don\'t have a BirQadam account yet?',
      'onboarding_account_desc': 'Redirecting you to the\nauthorization and\nregistration page',

      'onboarding_registration_title': 'Registration complete',
      'onboarding_registration_subtitle': 'Your application is approved!',
      'onboarding_registration_desc': 'Now let\'s set up notifications',
      'onboarding_enable_notifications': 'Enable notifications',
      'onboarding_notifications_enabled': 'Notifications enabled!',
      'onboarding_notifications_title': 'Stay in the loop',
      'onboarding_notifications_desc': 'Get information about new projects and tasks',

      // Notification examples
      'onboarding_notif_registration': 'Registration completed',
      'onboarding_notif_registration_desc': 'Welcome to BirQadam!',
      'onboarding_notif_checkin': 'Check-in reminder',
      'onboarding_notif_checkin_desc': 'Don\'t forget to check-in to your shift',
      'onboarding_notif_role': 'Role offered',
      'onboarding_notif_role_desc': 'You\'ve been offered a coordinator role',

      'onboarding_location_title': 'Allow location access',
      'onboarding_location_subtitle': 'Share your location for a better experience',
      'onboarding_location_desc': 'This will help you:',
      'onboarding_location_benefit1': 'Projects near you',
      'onboarding_location_benefit2': 'Navigation to location',
      'onboarding_location_benefit3': 'Event notifications',
      'onboarding_enable_location': 'Allow access',
      'onboarding_skip_location': 'Skip',
      'onboarding_location_enabled': 'Location access granted!',

      'onboarding_final_title': 'Welcome to the BirQadam community',
      'onboarding_final_subtitle': 'You\'re ready to start!',
      'onboarding_final_desc': 'Here you can:',
      'onboarding_final_benefit1': 'Discover new volunteer\nopportunities',
      'onboarding_final_benefit2': 'Support causes that\nmatter to you',
      'onboarding_final_benefit3': 'Become part of a global\ncommunity',
      'onboarding_lets_start': 'Let\'s start!',

      'onboarding_community_title': 'Join our community',
      'onboarding_community_desc': 'Be part of a volunteer team across Kazakhstan',
    },
  };

  String translate(String key) {
    return _localizedValues[locale.languageCode]?[key] ?? key;
  }

  // Shorthand method
  String t(String key) => translate(key);
}

class _AppLocalizationsDelegate
    extends LocalizationsDelegate<AppLocalizations> {
  const _AppLocalizationsDelegate();

  @override
  bool isSupported(Locale locale) {
    return ['ru', 'kk', 'en'].contains(locale.languageCode);
  }

  @override
  Future<AppLocalizations> load(Locale locale) async {
    return AppLocalizations(locale);
  }

  @override
  bool shouldReload(_AppLocalizationsDelegate old) => false;
}
