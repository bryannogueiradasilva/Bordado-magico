FROM node:18-bullseye

WORKDIR /app

# instala dependências

COPY package*.json ./
RUN npm install

# copia tudo

COPY . .

# 🔥 builda o frontend

RUN npm run build

# 🔥 força modo produção

ENV NODE_ENV=production

EXPOSE 8080

# 🔥 roda o server

CMD ["node", "server.ts"]
