# TCM-Test Docker 本地部署指南

## 前置条件

1. 安装 Docker Desktop
2. 配置 Docker 镜像加速器（推荐）

## 配置 Docker 镜像加速器

### 方法1：通过 Docker Desktop 设置

1. 打开 Docker Desktop
2. 点击 Settings（设置）
3. 选择 Docker Engine
4. 在配置中添加镜像加速器：

```json
{
  "registry-mirrors": [
    "https://docker.mirrors.ustc.edu.cn",
    "https://hub-mirror.c.163.com",
    "https://mirror.baidubce.com"
  ]
}
```

5. 点击 Apply & Restart

### 方法2：手动拉取基础镜像

如果配置加速器后仍无法拉取，可以手动下载镜像：

```powershell
# 使用代理或镜像站下载基础镜像
docker pull node:20-alpine
docker pull nginx:alpine
docker pull mongo:7
docker pull postgres:16-alpine
docker pull redis:7-alpine
```

## 部署步骤

### 1. 构建镜像

```powershell
# 在项目根目录执行
cd C:\Users\MR\Desktop\Rhinoc\projects\TCM-Test
docker-compose build
```

### 2. 启动服务

```powershell
# 使用脚本启动
.\docker-deploy.ps1 up

# 或直接使用 docker-compose
docker-compose up -d
```

### 3. 查看服务状态

```powershell
.\docker-deploy.ps1 status
# 或
docker-compose ps
```

### 4. 查看日志

```powershell
.\docker-deploy.ps1 logs
# 或
docker-compose logs -f
```

### 5. 停止服务

```powershell
.\docker-deploy.ps1 down
# 或
docker-compose down
```

## 访问服务

- **前端**: http://localhost
- **后端 API**: http://localhost:3001
- **MongoDB**: localhost:27017
- **PostgreSQL**: localhost:5432
- **Redis**: localhost:6379

## 服务说明

| 服务 | 容器名 | 端口 | 说明 |
|------|--------|------|------|
| MongoDB | tcm-mongodb | 27017 | 文档数据库 |
| PostgreSQL | tcm-postgres | 5432 | 关系型数据库 |
| Redis | tcm-redis | 6379 | 缓存服务 |
| 后端 | tcm-backend | 3001 | NestJS API |
| 前端 | tcm-frontend | 80 | React + Nginx |

## 常见问题

### 1. 镜像拉取失败

**解决方案**: 配置 Docker 镜像加速器，或手动下载镜像

### 2. 端口冲突

**解决方案**: 修改 `docker-compose.yml` 中的端口映射

```yaml
ports:
  - "8080:80"  # 将主机的8080映射到容器的80
```

### 3. 数据持久化

数据存储在 Docker 卷中：
- `mongodb_data`: MongoDB 数据
- `postgres_data`: PostgreSQL 数据
- `redis_data`: Redis 数据

### 4. 完全清理

```powershell
# 删除所有容器和数据卷
.\docker-deploy.ps1 clean
```

## 开发模式

如需在开发模式下运行（热重载）：

```powershell
# 只启动数据库服务
docker-compose up -d mongodb postgres redis

# 在本地启动后端（开发模式）
cd back
npm run start:dev

# 在本地启动前端（开发模式）
cd front
npm run dev
```
