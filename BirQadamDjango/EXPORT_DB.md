# 📦 Экспорт базы данных из локальной БД в Railway

## Способ 1: Через pgAdmin

1. Откройте pgAdmin
2. Правой кнопкой на `cleanup_almaty_db` → **Backup...**
3. Настройки:
   - **Filename**: `C:\Users\User\Desktop\backup.sql`
   - **Format**: `Plain` или `Custom`
   - **Encoding**: `UTF8`
4. Нажмите **Backup**

---

## Способ 2: Через командную строку

Откройте PowerShell и выполните:

```powershell
# Укажите правильный путь к pg_dump (обычно в PostgreSQL/bin)
& "C:\Program Files\PostgreSQL\17\bin\pg_dump.exe" -U postgres -d cleanup_almaty_db -F p > C:\Users\User\Desktop\backup.sql
```

Вас попросят ввести пароль PostgreSQL.

---

## Способ 3: Экспорт только структуры (без данных)

Если нужно только создать таблицы без данных:

```powershell
& "C:\Program Files\PostgreSQL\17\bin\pg_dump.exe" -U postgres -d cleanup_almaty_db -F p --schema-only > C:\Users\User\Desktop\schema_only.sql
```

---

## Импорт в Railway PostgreSQL

После экспорта нужно импортировать в Railway:

1. Получите строку подключения из Railway PostgreSQL → Variables → `DATABASE_URL`
2. Или используйте отдельные параметры: `PGHOST`, `PGUSER`, `PGPASSWORD`, `PGDATABASE`

### Импорт через psql:

```powershell
# Установите переменные из Railway
$env:PGHOST = "postgres.railway.internal"
$env:PGUSER = "postgres"
$env:PGPASSWORD = "VITpAGqhHTBInxWRYIwjuqCNnIUQpAaO"
$env:PGDATABASE = "railway"

# Импорт
& "C:\Program Files\PostgreSQL\17\bin\psql.exe" -h $env:PGHOST -U $env:PGUSER -d $env:PGDATABASE -f C:\Users\User\Desktop\backup.sql
```

---

## ⚠️ Важно

- Убедитесь, что Railway PostgreSQL пустая (нет таблиц)
- Или сначала выполните миграции Django, потом импортируйте данные
- Проверьте, что все внешние ключи и зависимости правильные

