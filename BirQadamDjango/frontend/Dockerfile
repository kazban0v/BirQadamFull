FROM node:20-alpine AS frontend

WORKDIR /app

# 1. Ставим зависимости
COPY package*.json ./
RUN npm ci

# 2. Копируем исходники
COPY . .

# 3. Чиним права на все бинарники из node_modules/.bin
RUN chmod +x node_modules/.bin/*

# 4. Собираем
RUN npm run build
