FROM node:18-bullseye as build

WORKDIR /app
COPY . .

RUN rm -rf node_modules package-lock.json
RUN npm install --force

RUN npm run build

FROM node:18-bullseye

WORKDIR /app

COPY --from=build /app .

RUN npm install --omit=dev

ENV PORT=8080
EXPOSE 8080

CMD ["node", "server.ts"]
