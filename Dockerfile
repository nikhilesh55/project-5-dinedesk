FROM node:22.13-bookworm-slim
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN npm install --no-audit --no-fund
COPY . .
RUN npm run build
ENV NODE_ENV=production PORT=3001
EXPOSE 3001
VOLUME ["/app/server/data"]
CMD ["npm", "start"]
