FROM node:20-alpine AS base
WORKDIR /app

COPY package.json yarn.lock ./
COPY services/sync/package.json ./services/sync/
RUN yarn install --frozen-lockfile --production=false

COPY services/sync/tsconfig.json ./services/sync/
COPY services/sync/src ./services/sync/src

WORKDIR /app/services/sync
EXPOSE 1234
CMD ["yarn", "start"]
