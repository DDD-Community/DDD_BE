FROM node:22-alpine AS deps
WORKDIR /app

COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

FROM node:22-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN yarn build

FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --production=true && yarn cache clean

COPY --from=builder /app/dist ./dist

# 이미지에 빌드 커밋을 각인한다.
# 배포 후 "실제로 어떤 커밋이 돌고 있는가" 를 이미지/런타임 양쪽에서 확인할 수 있어야
# 컨테이너가 갱신되지 않은 채 헬스체크만 통과하는 가짜 성공을 잡아낼 수 있다.
ARG GIT_SHA=unknown
ENV APP_VERSION=$GIT_SHA
LABEL org.opencontainers.image.revision=$GIT_SHA

# uid/gid 를 고정한다. gcp-key.json 은 호스트에서 바인드 마운트되고 배포 스크립트가
# 그 파일의 그룹을 컨테이너 gid 에 맞춰야 하는데, adduser -S 의 자동 배정 uid 는
# base image 가 바뀌면 함께 바뀌므로 스크립트가 기댈 수 없다.
RUN addgroup -S -g 10001 appgroup && adduser -S -u 10001 -G appgroup appuser
USER appuser

EXPOSE 3000

CMD ["node", "dist/main"]
