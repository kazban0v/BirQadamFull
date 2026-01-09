# ⚡ Быстрая инструкция: Коммит и пуш изменений

## 🚀 Выполните эти команды по порядку:

### 1. Перейдите в папку проекта
```powershell
cd C:\Users\User\Desktop\BirQadamFull-main
```

### 2. Проверьте статус (если Git уже инициализирован)
```powershell
git status
```

### 3. Если Git НЕ инициализирован - инициализируйте:
```powershell
git init
```

### 4. Добавьте все изменения
```powershell
git add .
```

### 5. Создайте коммит
```powershell
git commit -m "Подготовка к деплою на Railway: исправлены пути, добавлены конфигурационные файлы"
```

### 6. Если репозиторий уже подключен к GitHub - запушьте:
```powershell
git push origin main
```

**ИЛИ если ветка называется master:**
```powershell
git push origin master
```

### 7. Если репозиторий НЕ подключен - подключите:
```powershell
# Замените на ваш репозиторий:
git remote add origin https://github.com/ваш-username/ваш-репозиторий.git
git branch -M main
git push -u origin main
```

---

## ✅ Проверка

После пуша проверьте на GitHub что:
- ✅ Все файлы загружены
- ✅ `.env` файл НЕ виден (должен быть в .gitignore)
- ✅ `firebase-service-account.json` НЕ виден (должен быть в .gitignore)

---

## ⚠️ Если возникли ошибки

**Ошибка: "fatal: not a git repository"**
→ Выполните `git init` сначала

**Ошибка: "remote origin already exists"**
→ Пропустите шаг добавления remote, просто выполните `git push`

**Ошибка: "nothing to commit"**
→ Все изменения уже закоммичены, можно пушить

