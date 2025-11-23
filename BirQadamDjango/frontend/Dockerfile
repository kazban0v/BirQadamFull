# Базовый образ с Node
FROM node:20-alpine

# Рабочая директория
WORKDIR /app

# Сначала копируем package.json и package-lock.json
COPY package*.json ./

# Устанавливаем зависимости
RUN npm ci \
  && chmod +x node_modules/.bin/*

# Копируем остальной код
COPY . .

# Открываем порт Vite
EXPOSE 5173

# Запускаем Vite dev server
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5173"]
