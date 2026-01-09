# ---------- Stage 1: build ----------
FROM node:20-alpine AS build

WORKDIR /app

# Vite env (build-time)
ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}

# 1. Устанавливаем зависимости
COPY package*.json ./
RUN npm ci

# 2. Копируем исходники
COPY . .

# 3. Чиним права на бинарники, чтобы не было Permission denied
RUN chmod +x node_modules/.bin/*

# 4. Собираем
RUN npm run build   # тут всё равно упадёт, если есть TS-ошибки


# ---------- Stage 2: runtime (serve) ----------
FROM node:20-alpine AS frontend

WORKDIR /app

# Ставим serve глобально
RUN npm install -g serve

# Копируем только собранный фронт
COPY --from=build /app/dist ./dist

# Порт, на котором будет слушать serve
EXPOSE 4173

# Запускаем статический сервер
CMD ["serve", "-s", "dist", "-l", "4173"]
