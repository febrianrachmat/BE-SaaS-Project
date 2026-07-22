# Used by OpsCtrl when present.
FROM node:20-alpine AS deps
RUN apk add --no-cache openssl libc6-compat
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

FROM node:20-alpine AS build
RUN apk add --no-cache openssl libc6-compat
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build
RUN npm prune --omit=dev

FROM node:20-alpine AS runner
RUN apk add --no-cache openssl libc6-compat
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/scripts ./scripts
# OpsCtrl migrate job calls `prisma migrate deploy` from this image.
RUN cp ./scripts/prisma-bin-wrapper.sh ./node_modules/.bin/prisma \
  && chmod +x ./node_modules/.bin/prisma ./scripts/prisma-bin-wrapper.sh
CMD ["npm", "run", "start:prod"]
