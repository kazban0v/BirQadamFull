# 📋 Как добавить обработку ошибок при загрузке участников проекта

## 🎯 Цель
Добавить обработку ошибок сети и других ошибок при загрузке участников проекта для организатора, используя `ErrorScreen`.

---

## 📝 План реализации

### Шаг 1: Изменить метод `_loadProjectParticipants`

**Текущая реализация:**
```dart
Future<List<ProjectParticipant>> _loadProjectParticipants(int projectId) async {
  // ...
  try {
    // загрузка
    return participants;
  } catch (e) {
    print('Ошибка загрузки участников: $e');
    return []; // ❌ Возвращает пустой список, скрывая ошибку
  }
}
```

**Нужно изменить:**
1. Изменить возвращаемый тип на класс с результатом и ошибкой
2. ИЛИ добавить callback для обработки ошибок
3. ИЛИ передавать ошибку через параметр

**Рекомендуемый вариант:** Вернуть результат через специальный класс

---

### Вариант А: Использовать класс результата (рекомендуется)

#### 1. Создать класс результата (можно в начале файла `organizer_page.dart`):

```dart
class ParticipantsLoadResult {
  final List<ProjectParticipant> participants;
  final String? error;

  ParticipantsLoadResult({
    required this.participants,
    this.error,
  });

  bool get hasError => error != null;
  bool get isEmpty => participants.isEmpty && !hasError;
}
```

#### 2. Изменить метод `_loadProjectParticipants`:

```dart
Future<ParticipantsLoadResult> _loadProjectParticipants(int projectId) async {
  final authProvider = Provider.of<AuthProvider>(context, listen: false);
  final token = authProvider.token;
  if (token == null || token.isEmpty) {
    return ParticipantsLoadResult(
      participants: [],
      error: 'Не авторизован',
    );
  }

  try {
    final response = await http.get(
      Uri.parse(ApiService.projectParticipantsUrl(projectId)),
      headers: {
        'Authorization': 'Bearer $token',
        'Content-Type': 'application/json',
      },
    );

    if (response.statusCode == 200) {
      final data = jsonDecode(response.body);
      final participants = (data['participants'] as List)
          .map((participant) => ProjectParticipant.fromJson(participant))
          .toList();
      
      return ParticipantsLoadResult(
        participants: participants,
        error: null,
      );
    } else {
      return ParticipantsLoadResult(
        participants: [],
        error: 'Ошибка загрузки участников (${response.statusCode})',
      );
    }
  } catch (e) {
    print('Ошибка загрузки участников: $e');
    return ParticipantsLoadResult(
      participants: [],
      error: 'Ошибка подключения: $e',
    );
  }
}
```

#### 3. Изменить метод `_showProjectParticipantsDialog`:

```dart
void _showProjectParticipantsDialog(OrganizerProject project) async {
  // Показываем индикатор загрузки
  if (!mounted) return;
  
  showDialog(
    context: context,
    barrierDismissible: false, // Нельзя закрыть во время загрузки
    builder: (context) => const Center(
      child: CircularProgressIndicator(),
    ),
  );

  final result = await _loadProjectParticipants(project.id);
  
  if (!mounted) return;
  Navigator.pop(context); // Закрываем индикатор загрузки

  // Проверяем наличие ошибки
  if (result.hasError) {
    final error = result.error!.toLowerCase();
    
    // Определяем, это ошибка сети или другая ошибка
    if (error.contains('подключения') || 
        error.contains('connection') || 
        error.contains('network') || 
        error.contains('socketexception') ||
        error.contains('clientexception') ||
        error.contains('unreachable') ||
        error.contains('timed out') ||
        error.contains('failed host lookup')) {
      // Показываем полноэкранный ErrorScreen в диалоге
      showDialog(
        context: context,
        barrierDismissible: true,
        builder: (context) => Dialog(
          backgroundColor: Colors.transparent,
          insetPadding: EdgeInsets.zero,
          child: Container(
            width: MediaQuery.of(context).size.width * 0.95,
            height: MediaQuery.of(context).size.height * 0.8,
            child: ErrorScreens.noInternet(
              onRetry: () {
                Navigator.pop(context); // Закрываем текущий диалог
                _showProjectParticipantsDialog(project); // Перезагружаем
              },
              onClose: () => Navigator.pop(context),
            ),
          ),
        ),
      );
      return;
    } else {
      // Другие ошибки показываем через ErrorScreen.loadError
      showDialog(
        context: context,
        barrierDismissible: true,
        builder: (context) => Dialog(
          backgroundColor: Colors.transparent,
          insetPadding: EdgeInsets.zero,
          child: Container(
            width: MediaQuery.of(context).size.width * 0.95,
            height: MediaQuery.of(context).size.height * 0.8,
            child: ErrorScreens.loadError(
              onRetry: () {
                Navigator.pop(context);
                _showProjectParticipantsDialog(project);
              },
              onClose: () => Navigator.pop(context),
            ),
          ),
        ),
      );
      return;
    }
  }

  // Если нет ошибки, показываем обычный диалог со списком участников
  showDialog(
    context: context,
    builder: (context) => Dialog(
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(28),
      ),
      child: Container(
        width: MediaQuery.of(context).size.width * 0.95,
        height: MediaQuery.of(context).size.height * 0.8,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(28),
          color: Colors.white,
        ),
        child: Column(
          children: [
            // Заголовок (существующий код)
            // ...
            
            // Список участников
            Expanded(
              child: result.participants.isEmpty
                  ? Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(
                            Icons.group_off,
                            size: 64,
                            color: Colors.grey[400],
                          ),
                          const SizedBox(height: 16),
                          Text(
                            'Пока нет участников',
                            // ... существующий код
                          ),
                        ],
                      ),
                    )
                  : ListView.builder(
                      // ... существующий код для списка участников
                    ),
            ),
          ],
        ),
      ),
    ),
  );
}
```

---

### Вариант Б: Использовать StatefulBuilder в диалоге (проще, но менее элегантно)

Если не хочется создавать класс результата, можно использовать `StatefulBuilder`:

#### 1. Оставить метод `_loadProjectParticipants` как есть, но добавить параметр для передачи ошибки:

```dart
Future<List<ProjectParticipant>> _loadProjectParticipants(
  int projectId, {
  Function(String)? onError,
}) async {
  // ...
  try {
    // загрузка
    return participants;
  } catch (e) {
    print('Ошибка загрузки участников: $e');
    onError?.call('Ошибка подключения: $e');
    return [];
  }
}
```

#### 2. Изменить `_showProjectParticipantsDialog`:

```dart
void _showProjectParticipantsDialog(OrganizerProject project) async {
  String? loadError;
  
  showDialog(
    context: context,
    barrierDismissible: false,
    builder: (context) => const Center(
      child: CircularProgressIndicator(),
    ),
  );

  final participants = await _loadProjectParticipants(
    project.id,
    onError: (error) => loadError = error,
  );
  
  if (!mounted) return;
  Navigator.pop(context);

  // Если есть ошибка
  if (loadError != null && participants.isEmpty) {
    final error = loadError!.toLowerCase();
    
    if (error.contains('подключения') || 
        error.contains('connection') || 
        // ... остальные проверки) {
      showDialog(
        context: context,
        builder: (context) => Dialog(
          backgroundColor: Colors.transparent,
          insetPadding: EdgeInsets.zero,
          child: Container(
            width: MediaQuery.of(context).size.width * 0.95,
            height: MediaQuery.of(context).size.height * 0.8,
            child: ErrorScreens.noInternet(
              onRetry: () {
                Navigator.pop(context);
                _showProjectParticipantsDialog(project);
              },
              onClose: () => Navigator.pop(context),
            ),
          ),
        ),
      );
      return;
    }
  }

  // Показываем обычный диалог
  // ... существующий код
}
```

---

## ✅ Рекомендуемый подход: Вариант А

**Преимущества:**
- ✅ Чистый код с явным возвращаемым типом
- ✅ Легко расширять (можно добавить статус загрузки, метаданные)
- ✅ Явная обработка ошибок
- ✅ Соответствует паттерну Result/Response объектов

---

## 📝 Пошаговая инструкция реализации (Вариант А)

1. **Добавить класс результата** в начало файла `organizer_page.dart` (после импортов, перед классом `OrganizerProject`)

2. **Изменить сигнатуру метода** `_loadProjectParticipants`:
   - Возвращаемый тип: `Future<ParticipantsLoadResult>`
   - Внутри возвращать `ParticipantsLoadResult` вместо списка

3. **Добавить проверку ошибок** в `_showProjectParticipantsDialog`:
   - После получения результата проверить `result.hasError`
   - Определить тип ошибки (сеть или другая)
   - Показать соответствующий `ErrorScreen` в диалоге

4. **Обновить использование результата**:
   - Вместо `participants.isEmpty` использовать `result.participants.isEmpty`
   - Проверять `result.hasError` перед показом пустого состояния

---

## 🔍 Где находится код

- **Файл:** `BirQadamApp/lib/screens/main/organizer_page.dart`
- **Метод загрузки:** `_loadProjectParticipants()` - строка ~224
- **Метод показа диалога:** `_showProjectParticipantsDialog()` - строка ~2355

---

## ⚠️ Важные моменты

1. **Проверка `mounted`:** Обязательно проверять `if (!mounted) return;` перед использованием `context` после `await`

2. **Закрытие предыдущего диалога:** Если показывается индикатор загрузки, его нужно закрыть перед показом нового диалога

3. **Обработка ошибок сети:** Использовать расширенную проверку как в других местах:
   - `подключения`, `connection`, `network`
   - `socketexception`, `clientexception`
   - `unreachable`, `timed out`, `failed host lookup`

4. **Стилизация диалога с ErrorScreen:** 
   - Использовать `backgroundColor: Colors.transparent`
   - Использовать `insetPadding: EdgeInsets.zero` для полноэкранного вида
   - Установить размеры через `Container`

---

## 📊 После реализации

**Было:**
- Ошибки загрузки только логировались
- Пустой список участников (нельзя различить "нет участников" и "ошибка загрузки")

**Станет:**
- ✅ Ошибки сети показываются через `ErrorScreens.noInternet()`
- ✅ Другие ошибки показываются через `ErrorScreens.loadError()`
- ✅ Кнопка "Повторить" перезагружает участников
- ✅ Пользователь видит понятное сообщение об ошибке

---

**Готово к реализации!** 🚀



