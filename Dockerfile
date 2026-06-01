FROM node:20-bookworm-slim

WORKDIR /app

# Dépendances backend (Linux — pas les node_modules Windows du PC)
COPY backend/package.json backend/package-lock.json ./backend/
RUN npm ci --prefix backend --omit=dev

# Code backend + frontend (servi par Express)
COPY backend ./backend
COPY frontend ./frontend

WORKDIR /app/backend

ENV NODE_ENV=production

# Railway injecte PORT automatiquement
CMD ["node", "server.js"]
