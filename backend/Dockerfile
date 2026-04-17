
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev


FROM node:20-alpine AS runner
WORKDIR /app


RUN addgroup -S appgroup && adduser -S appuser -G appgroup

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN rm -rf tests/ *.test.js .env* docker-compose*.yml

RUN chown -R appuser:appgroup /app
USER appuser

EXPOSE 5000

ENV NODE_ENV=production

CMD ["node", "server.js"]