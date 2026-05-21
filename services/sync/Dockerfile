FROM node:24-alpine AS base
WORKDIR /app

COPY package.json yarn.lock ./
COPY packages/shared/package.json ./packages/shared/
COPY services/sync/package.json ./services/sync/
RUN yarn install --frozen-lockfile --production=false

COPY packages/shared/src ./packages/shared/src
COPY services/sync/tsconfig.json ./services/sync/
COPY services/sync/src ./services/sync/src
COPY db ./db

WORKDIR /app/services/sync
EXPOSE 1234
CMD ["yarn", "start"]
