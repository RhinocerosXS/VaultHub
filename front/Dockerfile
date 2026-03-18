# 前端Dockerfile - 本地构建
# 使用本地Docker Desktop的镜像缓存
FROM node:20-alpine AS builder

WORKDIR /app

# 复制package.json和package-lock.json
COPY package*.json ./

# 安装依赖
RUN npm ci

# 复制源代码
COPY . .

# 构建应用
RUN npm run build

# 生产环境 - 使用nginx
FROM nginx:alpine AS production

# 复制nginx配置文件
COPY nginx.conf /etc/nginx/conf.d/default.conf

# 从builder阶段复制构建产物到nginx目录
COPY --from=builder /app/dist /usr/share/nginx/html

# 暴露端口
EXPOSE 80

# 启动nginx
CMD ["nginx", "-g", "daemon off;"]
