# Build stage
FROM node:18-bullseye as build

WORKDIR /app
COPY package*.json ./

# 👇 força instalação limpa correta
RUN npm install --legacy-peer-deps

COPY . .

# 👇 resolve bug do esbuild
RUN npm rebuild esbuild

RUN npm run build

# Production stage
FROM node:18-bullseye

WORKDIR /app

COPY --from=build /app .

RUN npm install --omit=dev

ENV PORT=8080
EXPOSE 8080

CMD ["node", "server.ts"]
