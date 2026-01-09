# 🔧 Настройка базы данных в Railway

## Шаг 1: Создание PostgreSQL (если еще нет)

1. В Railway Dashboard нажмите **"+ New"**
2. Выберите **"Database"** → **"PostgreSQL"**
3. Дождитесь создания (1-2 минуты)

---

## Шаг 2: Добавление переменных в Django сервис

Откройте сервис **BirQadamFull** → **Variables** → добавьте:

### Вариант 1: Используя ссылки на PostgreSQL сервис (РЕКОМЕНДУЕТСЯ)

```
DB_NAME = ${PGDATABASE}
DB_USER = ${PGUSER}
DB_PASSWORD = ${PGPASSWORD}
DB_HOST = ${PGHOST}
DB_PORT = ${PGPORT}
```

**Как добавить:**
1. Нажмите **"+ New Variable"**
2. Name: `DB_NAME`
3. Value: `${PGDATABASE}`
4. Повторите для остальных 4 переменных

---

### Вариант 2: Если ${PGDATABASE} не работает

1. Откройте **PostgreSQL сервис** → **Variables**
2. Скопируйте значения:
   - `PGDATABASE` (например: `railway`)
   - `PGUSER` (например: `postgres`)
   - `PGPASSWORD` (длинная строка)
   - `PGHOST` (например: `containers-us-west-xxx.railway.app`)
   - `PGPORT` (например: `5432`)

3. В **BirQadamFull** → **Variables** добавьте:

```
DB_NAME = скопированное-значение-PGDATABASE
DB_USER = скопированное-значение-PGUSER
DB_PASSWORD = скопированное-значение-PGPASSWORD
DB_HOST = скопированное-значение-PGHOST
DB_PORT = скопированное-значение-PGPORT
```

---

## ✅ После добавления

Railway автоматически перезапустит деплой. Проверьте логи - ошибка подключения к БД должна исчезнуть.

