# Static export built with Node, served by nginx. Build context: nextjs/.
FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@11.19.0 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
ARG NEXT_PUBLIC_AVIATION_API_URL=https://aviation.lab.vibecde.com
ENV NEXT_PUBLIC_AVIATION_API_URL=$NEXT_PUBLIC_AVIATION_API_URL NEXT_TELEMETRY_DISABLED=1
RUN pnpm build

FROM nginx:alpine
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/out /usr/share/nginx/html
