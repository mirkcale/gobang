# ============================================
# 前端 Dockerfile - 多阶段构建（nginx）
# ============================================

# ---- 构建阶段 ----
FROM node:24-alpine AS builder

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# 复制 workspace 配置和 lockfile
COPY pnpm-lock.yaml pnpm-workspace.yaml ./
COPY package.json ./

# 安装依赖
RUN pnpm install --frozen-lockfile --prod=false

# 复制前端源码
COPY vite.config.js ./
COPY index.html ./
COPY src ./src

# 构建生产包
RUN pnpm run build

# ---- 运行阶段：nginx ----
FROM nginx:1.27-alpine AS production

# 复制构建产物到 nginx 静态目录
COPY --from=builder /app/build /usr/share/nginx/html

# 复制 nginx 配置
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
