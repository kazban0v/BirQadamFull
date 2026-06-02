# 🔍 BirQadam — Полный аудит проекта
> Дата: 27.05.2026 | Ветка: feature/updates  
> Охват: custom-admin (Django), web-portal (Vue/Vite), Expo BirQadam (React Native)

---

## 📋 СОДЕРЖАНИЕ
1. [Сводка по приоритетам](#сводка)
2. [Django Backend / custom-admin](#django)
3. [Web Portal (Vue/Vite)](#portal)
4. [Expo Mobile App](#expo)

---

## 🚨 СВОДКА ПО ПРИОРИТЕТАМ {#сводка}

### КРИТИЧЕСКИЕ (ломают работу прямо сейчас)
| # | Место | Проблема |
|---|-------|----------|
| C1 | Expo / `network.ts` | **Неверный домен по умолчанию** — `cleanup.almau.edu.kz` вместо `birqadam.almau.edu.kz`. Если `EXPO_PUBLIC_API_BASE_URL` не задан — все запросы уходят не туда |
| C2 | Django / `settings.py` | **`CORS_ALLOW_ALL_ORIGINS = True`** захардкожен без условия — работает и в продакшне, любой сайт может делать запросы с куками |
| C3 | Portal / `tasks.ts` | **Волонтёры вызывают `/custom-admin/api/v1/tasks/`** — это admin endpoint. Получают 403 или чужие данные |
| C4 | Portal / `projects.ts` | **`leaveVolunteerProject` вызывает admin endpoint** — волонтёр не может выйти из проекта |
| C5 | Portal / `tasks.ts` | **`dismissTask` вызывает admin endpoint** — кнопка "скрыть задачу" не работает для волонтёров |
| C6 | Django / `views.py` | **`export_report` отдаёт HTML-страницу вместо файла** когда кэш тёплый (логика инвертирована) |
| C7 | Django / `views.py` | **Уведомления могут откатить статус проекта** — `async` внутри `transaction.atomic()` в `project_moderate_approve/reject` |
| C8 | Expo / `MyProjectsScreen` | **Хуки вызываются внутри `useCallback`** — прямое нарушение Rules of Hooks, runtime crash при рендере карточек |
| C9 | Portal / `DashboardView.vue` | **`uploadPhotoReport` передаёт `FormData` вместо `File`** — загрузка фото отчётов не работает |
| C10 | Portal / `projects.ts` | **`fetchProjectTasks` — путь без `/v1/`** → 404 на всех запросах задач проекта |

### ВЫСОКИЙ ПРИОРИТЕТ (неверные данные, логика сломана)
| # | Место | Проблема |
|---|-------|----------|
| H1 | Expo / `useDashboard.ts` | `total_tasks` показывает `active_tasks` (перепутаны поля) |
| H2 | Expo / `useDashboard.ts` | `total_points` показывает `achievements_count` (перепутаны поля) |
| H3 | Expo / `DashboardScreen` | `nearestTask.deadline_date` не существует в типе — всегда "дата не указана" |
| H4 | Expo / `DashboardScreen` | Кнопка "Избранное" **сбрасывает** все фильтры вместо того чтобы фильтровать |
| H5 | Django / `stats.py` | **График рейтинга — выдуманные данные** (`count × 0.5`), нет связи с реальными изменениями |
| H6 | Django / `views.py` | **`LeaderboardAPIView` загружает всех пользователей в память** для поиска ранга — OOM при масштабировании |
| H7 | Django / `views.py` | **Сортировка волонтёров по `task_count`** использует DB-аннотацию, а отображается другое число (несовпадение) |
| H8 | Portal / `DashboardView.vue` | `showOnboarding` **всегда возвращает `true`** — онбординг показывается на каждый вход |
| H9 | Portal / `NotificationsView.vue` | Прочитанные уведомления **полностью скрываются** — нельзя посмотреть историю |
| H10 | Portal / `ProfileView.vue` | **"Сохранить настройки уведомлений" — no-op** с фейковым success-сообщением |
| H11 | Django / `users/models.py` | **`update_average_rating` может удвоить рейтинг** — запись добавляется до и после DB-запроса |
| H12 | Django / `task.py` | **Второй волонтёр может принять ту же задачу** — нет conflict detection; статус перезаписывается |
| H13 | Expo / `ProfileScreen` | Прогресс уровня считается локально с хардкодом (750/100) — игнорирует данные `/stats/` |
| H14 | Portal / `AnalyticsView.vue` | Фильтр по дате аналитики не передаёт параметры на бэк — данные не фильтруются |

### БЕЗОПАСНОСТЬ
| # | Место | Проблема |
|---|-------|----------|
| S1 | Django / `settings.py` | `SECRET_KEY` fallback = `'django-insecure-...'` — если нет `.env`, JWT и сессии компрометированы |
| S2 | Django / `views.py` | **Полный traceback в HTTP 500** в продакшне (`dashboard` view) — утечка путей и переменных |
| S3 | Django / `search.py` | **`global_search` и `advanced_user_search` — `AllowAny`** — email, телефоны, роли всех пользователей доступны без авторизации |
| S4 | Django / `middleware.py` | **`LoginAttemptMiddleware` слушает `/admin/login/`** вместо `/custom-admin/login/` — защита от brute force не работает |
| S5 | Django / `views.py` | FCM device tokens **выводятся в stdout** (`print()`) в продакшне |
| S6 | Django / `settings.py` | `SESSION_COOKIE_SAMESITE = "None"` — куки отправляются cross-site, возможны CSRF-атаки |

### СРЕДНИЙ ПРИОРИТЕТ (UX, производительность, некорректное поведение)
| # | Место | Проблема |
|---|-------|----------|
| M1 | Portal / `ProtectedLayout.vue` | `router.beforeEach/afterEach` накапливаются при каждом монтировании — утечка памяти и дублирование guards |
| M2 | Portal / `auth.ts` | `authStore.initialize()` не `await`ится — race condition при каждой загрузке |
| M3 | Portal / `tasks.ts` | Module-level cache задач **не очищается при logout** — новый пользователь видит данные предыдущего |
| M4 | Django / `views.py` | **GET endpoint изменяет данные** — `UserTasksAPIView` архивирует задачи при каждом просмотре списка |
| M5 | Django / `views.py` | **Календарь admin показывает только `status='open'`** — нет задач в процессе, на ревью |
| M6 | Expo / `ChatDetailScreen` | Polling без отмены запросов — старые ответы могут перезаписать новые (race condition) |
| M7 | Expo / `ProfileScreen` | Искусственные задержки 350ms + 350ms = **700ms лишней latency** при каждом открытии профиля |
| M8 | Expo / `projectUtils.ts` | Типы волонтёрства и сортировка **захардкожены на русском** — нет i18n |
| M9 | Expo / `app.json` | Ссылается на `notification-sound.wav` которого **нет в assets** — сборка может упасть |
| M10 | Expo / `App.tsx` | `LogBox.ignoreLogs` скрывает Network Error глобально — debug в продакшне сломан |
| M11 | Portal / `VolunteersView.vue` | Chat polling продолжается **после закрытия диалога** |
| M12 | Django / `middleware.py` | Rate limit для photo reports **никогда не срабатывает** — неверное сопоставление путей |
| M13 | Expo / `EditProfileScreen` | Отправляет `name` вместо `full_name` — бэк игнорирует обновление имени |
| M14 | Expo / `CalendarScreen` | Неделя начинается с воскресенья (JS) но метки идут с понедельника — смещение на 1 день |

---

## 🐍 DJANGO BACKEND / custom-admin {#django}

### 1. Критические баги

#### C6 — `export_report` отдаёт HTML при тёплом кэше
**Файл:** `admin_panel/views.py`, строки ~573–577  
```python
# Если кэш есть — рендерит analytics.html вместо файла-скачивания
cached_context = cache.get(cache_key)
if cached_context:
    return render(request, 'admin_panel/analytics.html', cached_context)  # БАГ
```
Пользователь нажимает "Экспорт" — получает HTML-страницу аналитики вместо CSV/PDF.

#### C7 — Async внутри transaction.atomic() откатывает статус проекта
**Файл:** `admin_panel/views.py`, строки ~1230–1234  
```python
with transaction.atomic():
    project.status = 'approved'
    project.save(update_fields=['status'])
    project.approve()  # вызывает async_to_sync(NotificationService...) — если падает, всё откатывается
```
Если уведомление упало → проект остаётся `pending`, несмотря на действие модератора.

#### — Задания TaskAssignment не инвалидируются при удалении проекта
**Файл:** `projects/models.py`, строка 94  
```python
# Фильтрует completed=False и ставит completed=False — NO-OP
TaskAssignment.objects.filter(task__project=self, completed=False).update(completed=False)
```

#### — Double-save race condition для статуса `pending`
**Файл:** `views.py`, строки ~2168–2177  
ORM `project.save()` перезаписывает raw SQL UPDATE. Есть второй SQL-костыль, но root cause не исправлен.

---

### 2. Логические ошибки

| Проблема | Файл | Описание |
|----------|------|----------|
| Выдуманный график рейтинга | `stats.py` | История строится как `count × 0.5` — нет связи с реальными данными |
| OOM в леадерборде | `views.py` | Загружает всех пользователей в память для определения ранга |
| Задача меняет статус при каждом `accept` | `task.py` | Второй волонтёр принимает задачу → статус перезаписывается |
| GET-endpoint пишет в БД | `views.py` | `UserTasksAPIView` архивирует задачи при каждом GET |
| `bulk_notifications` preview ≠ реальная отправка | `bulk_notifications.py` | `filter_city` в preview игнорируется, в отправке — нет |
| Дублирование рейтинга | `users/models.py` | `Photo.approve()` и `RatePhotoReportAPIView` оба добавляют очки — двойное начисление |
| Сравнение наивного и aware времени | `task.py` | `task.start_time` (naive) vs `timezone.now().time()` (UTC), UTC+5 → ошибка 5 часов |

---

### 3. Проблемы с отображением данных

| Проблема | Файл |
|----------|------|
| Redirect `project_restore` → `NoReverseMatch` | `views.py` (неймспейс не указан) |
| Календарь показывает только `status='open'` задачи | `views.py` |
| Фото загружаются без пагинации у волонтёра | `views.py` |
| Данные фото кэшируются как объекты Django 15 минут | `views.py` |
| `approveDialog.photoId` — undefined (надо `photoIds`) | `TasksView.vue` |

---

### 4. Безопасность

| # | Файл | Проблема |
|---|------|----------|
| S1 | `settings.py:13` | `SECRET_KEY` default = insecure строка |
| S2 | `views.py` | Full traceback в 500-ответе в продакшне |
| S3 | `search.py` | `global_search` без авторизации, отдаёт email/телефоны |
| S4 | `middleware.py` | Brute force слушает `/admin/login/` — неверный путь |
| S5 | `views.py` | FCM токены в `print()` → stdout продакшна |
| S6 | `settings.py` | `CORS_ALLOW_ALL_ORIGINS = True` без условия |
| S7 | `settings.py` | `SESSION_COOKIE_SAMESITE = "None"` |
| S8 | `middleware.py` | `LoginAttemptMiddleware.record_failed_attempt` — не атомарный инкремент |
| S9 | `settings.py` | `ALLOWED_HOSTS = ['*']` как fallback в продакшне (только warning) |

---

## 🌐 WEB PORTAL (Vue/Vite) {#portal}

### 1. Критические баги

#### C3/C4/C5 — Волонтёрские действия идут через admin endpoints
**Файл:** `src/services/tasks.ts`, `src/services/projects.ts`
```
GET  /custom-admin/api/v1/tasks/           ← волонтёр видит задачи (403 или admin-данные)
DELETE /custom-admin/api/v1/tasks/.../dismiss/  ← кнопка "скрыть" не работает
POST /custom-admin/api/v1/projects/.../leave/   ← выход из проекта не работает
```

#### C9 — Загрузка фото отчётов
**Файл:** `src/views/volunteer/DashboardView.vue`, строка ~624  
```js
uploadPhotoReport(selectedTask.value.task_id, formData)  
// formData — это FormData, но сервис ожидает File | File[]
// Результат: отправляется пустой/неверный запрос
```

#### C10 — fetchProjectTasks без `/v1/`
**Файл:** `src/services/projects.ts`
```
GET /custom-admin/api/projects/{id}/tasks/   ← 404
    (нужно: /custom-admin/api/v1/projects/{id}/tasks/)
```

#### M1 — Накопление router guards
**Файл:** `src/layouts/ProtectedLayout.vue`  
`router.beforeEach` регистрируется каждый раз при монтировании layout без очистки → guards выполняются N раз.

---

### 2. Логические ошибки

| Проблема | Файл |
|----------|------|
| `showOnboarding` всегда `true` | `DashboardView.vue` |
| Кэш задач не очищается при logout | `tasks.ts` |
| Race condition при logout | `auth.ts` |
| Двойной interval на орг. дашборде | `DashboardView.vue` |
| Фильтр аналитики не передаёт параметры на бэк | `AnalyticsView.vue` |
| Если в диапазоне ≤1 точки — фильтр молча игнорируется | `AnalyticsView.vue` |
| Chat polling не останавливается при закрытии диалога | `VolunteersView.vue` |
| `selectedProjectId` берётся из пустого store при ините | `VolunteersView.vue` |
| `saveNotificationSettings` — no-op с фейковым success | `ProfileView.vue` |
| Дублирование API-вызова `getOrganizerProfile` x2 на маунте | `ProfileView.vue` |

---

### 3. API проблемы

| Endpoint | Проблема |
|----------|----------|
| `router.createWebHistory('/portal/')` vs `vite.config base: '/'` | Mismatch → 404 на прямых URL |
| `WEB_ENDPOINT` переопределён в `ai.ts` | Дублирование, не синхронизируется |
| `deletePhotoReport(taskId)` | Параметр `taskId` → удаляет по task, а не по photo ID |
| POST-fallback в `deletePhotoReport` | При network error → `POST action: 'withdraw'` (нежелательный side effect) |
| Аналитика орг. → `/custom-admin/api/v1/user/stats/` | Admin endpoint, орг. получит 403 |

---

### 4. Отсутствие обработки ошибок

- `loadDashboard()` — нет try/catch → частичные данные без уведомления
- `loadNotifications` — нет catch → пустой список без объяснения
- `loadProfile` (оба портала) — нет catch
- `startChat`, `sendMessage`, `loadChatMessages` — только `console.error`
- Camera blob URL не освобождается при unmount → утечка памяти
- `isNavigating` overlay может зависнуть навсегда

---

## 📱 EXPO MOBILE APP {#expo}

### 1. Критический баг №1: Неверный домен

**Файл:** `src/utils/network.ts`, строка 4
```ts
const PRODUCTION_API_BASE_URL = 
  process.env.EXPO_PUBLIC_API_BASE_URL?.trim() || 'https://cleanup.almau.edu.kz';
//                                                   ^^^^^^^^^ СТАРЫЙ ДОМЕН?
```
Если переменная окружения не задана в production build → все запросы идут на `cleanup.almau.edu.kz`. 

**Нужно уточнить:** какой домен правильный для Expo: `cleanup.almau.edu.kz` или `birqadam.almau.edu.kz`?

---

### 2. Критический баг: Hooks в useCallback

**Файл:** `src/screens/volunteer/MyProjectsScreen.tsx`, строки 182-200
```tsx
// GridCard определён через useCallback → hooks внутри = нарушение Rules of Hooks
const GridCard = useCallback(() => {
  const animRef = useRef(...)   // ← НЕЛЬЗЯ
  useEffect(() => {...}, [])    // ← НЕЛЬЗЯ
  return <View>...</View>
}, [])
```
Runtime crash при рендере сетки проектов.

---

### 3. Неверные данные на дашборде

**Файл:** `src/hooks/useDashboard.ts`
```ts
total_tasks: summary.active_tasks || 0,    // показывает активные, не общее кол-во
total_points: summary.achievements_count || 0,  // показывает кол-во достижений, не очки
```

**Файл:** `src/screens/volunteer/DashboardScreen.tsx`
```ts
// nearestTask.deadline_date — поле не существует в типе Task
// Task имеет end_date, но оно не маппится → всегда "дата не указана"
nearestTask.deadline_date  // undefined всегда
```

---

### 4. Логические ошибки

| Проблема | Файл |
|----------|------|
| "Избранное" сбрасывает все фильтры вместо показа избранного | `DashboardScreen.tsx` |
| `isDeclinedTask` = true для любой архивной задачи | `VolunteerTaskDetailScreen.tsx` |
| `heroImageIndex` выходит за границы массива → crash | `VolunteerTaskDetailScreen.tsx` |
| Прогресс уровня считается с хардкодом, игнорируя `/stats/` | `ProfileScreen.tsx` |
| Chat polling: `chatUnavailable` в closure — stale значение | `ChatDetailScreen.tsx` |
| `blockUser` не сохраняет `blockId` → unblock невозможен | `moderationStore.ts` |
| Календарь: смещение на 1 день (JS Sun=0 vs метки Пн...) | `CalendarScreen.tsx` |
| Статистика/достижения: ошибки нагрузки молча игнорируются | `AchievementsScreen.tsx` |

---

### 5. API проблемы

| Проблема | Файл |
|----------|------|
| Token refresh через `/custom-admin/api/token/refresh/` — admin prefix | `api.ts` |
| `submitPhotoReport` и `submitPhotoReportV1` — дубли одного endpoint | `api.ts` |
| `Promise.all` из 3 запросов при каждом фокусе экрана | `useDashboard.ts` |
| Hardcoded 350ms + 350ms задержки в ProfileScreen | `ProfileScreen.tsx` |
| `fetchBlockedUsers` store-функция не используется | `BlockedUsersScreen.tsx` |

---

### 6. i18n / локализация

Следующие строки **захардкожены на русском** несмотря на наличие i18n:
- `getVolunteerTypeLabel()` — типы волонтёрства (`projectUtils.ts`)
- `getSortLabel()` — метки сортировки (`projectUtils.ts`)
- Fallback `Фотоотчёт #N` (`ActivityScreen`, `AchievementsScreen`)
- Экран "Заблокированные пользователи" — title в навигаторе
- Причины жалоб в `ModerationMenu`

---

## 🗺️ ПРЕДЛАГАЕМЫЙ ПОРЯДОК ИСПРАВЛЕНИЙ

### Этап 1 — Срочно (сломано прямо сейчас)
1. **C3/C4/C5** Portal: поправить endpoints для волонтёров (tasks, dismiss, leave)
2. **C1** Expo: проверить и исправить базовый URL API
3. **C2** Django: `CORS_ALLOW_ALL_ORIGINS` убрать в env-условие
4. **C8** Expo: вынести `GridCard` из `useCallback` в нормальный компонент
5. **C9** Portal: `uploadPhotoReport` — передавать `File` вместо `FormData`
6. **C10** Portal: добавить `/v1/` в `fetchProjectTasks`
7. **C6** Django: исправить `export_report` — кэш не должен возвращать HTML
8. **C7** Django: убрать уведомления из `transaction.atomic()`

### Этап 2 — Данные
1. **H1/H2** Expo: исправить маппинг полей в `useDashboard`
2. **H3** Expo: использовать `end_date` вместо `deadline_date`
3. **H4** Expo: починить кнопку "Избранное"
4. **H5** Django: реальный график рейтинга через историю событий
5. **H8** Portal: исправить `showOnboarding`
6. **H10** Portal: реализовать или убрать `saveNotificationSettings`
7. **M13** Expo: `name` → `full_name` в `EditProfileScreen`

### Этап 3 — Безопасность
1. **S2** Django: убрать traceback из HTTP 500
2. **S3** Django: добавить `IsAuthenticated` на `global_search`
3. **S4** Django: исправить путь в `LoginAttemptMiddleware`
4. **S5** Django: убрать `print()` с FCM токенами
5. **S1** Django: добавить проверку `SECRET_KEY` при старте

### Этап 4 — Качество и UX
- Portal: очистка router guards (`beforeEach` cleanup)
- Portal: обработка ошибок во всех `loadXxx` функциях
- Portal: chat polling cleanup
- Expo: убрать hardcoded задержки 350ms
- Expo: `blockUser` → сохранять `blockId`
- Expo: i18n для всех Russian hardcoded строк
- Django: пагинация для `VolunteerPhotoReportsAPIView`
- Django: `LeaderboardAPIView` — подсчёт ранга через subquery

---

*Всего найдено: ~85 проблем | Критических: 10 | Высокий приоритет: 14 | Безопасность: 9 | Средний: 15+*
