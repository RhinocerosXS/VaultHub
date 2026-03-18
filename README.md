# TCM Obsidian - 中医知识管理与协作平台

TCM Obsidian 是一个专为中医领域设计的知识管理与协作平台，融合了现代笔记软件的功能与人工智能辅助技术，帮助中医从业者、研究人员和爱好者更好地管理、分享和探索中医知识。

## 项目概述

本项目采用前后端分离架构，包含以下主要模块：

- **前端 (front/)**: 基于 React + TypeScript + Vite 构建的现代化用户界面
- **后端 (back/)**: 基于 NestJS + TypeScript 的 RESTful API 服务
- **RAG 模块**: 集成 LightRAG 实现智能知识检索与问答

## 核心功能

### 1. 知识库管理 (Vaults)

- 创建个人或社区知识库
- 支持文件夹和文件的层级管理
- 支持 Word、PDF、Markdown 等多种文件格式
- 知识库链接与同步功能
- 协作编辑与权限管理

### 2. 社区功能 (Community)

- 博客发布与阅读
- 开源项目分享
- 学习资源推荐
- 用户关注与互动
- 内容点赞、收藏、转发

### 3. AI 工坊 (AI Workshop)

- 基于 RAG (检索增强生成) 的智能问答
- 支持多种 LLM 提供商 (OpenAI、Gemini、阿里云等)
- 知识图谱可视化
- 智能文档解析与向量化
- 多模式查询 (naive、local、global、hybrid、mix)

### 4. 交互功能 (Interactions)

- 文件收藏与书签
- 文本高亮与批注
- 评论与讨论
- 私信功能
- 通知系统

### 5. 社群功能 (Groups)

- 创建和加入社群
- 群组聊天
- 成员管理
- 邀请与申请机制

## 技术栈

### 前端

- **框架**: React 19 + TypeScript
- **构建工具**: Vite 6
- **路由**: React Router DOM 7
- **编辑器**: Vditor (Markdown)、TipTap
- **UI 组件**: Tailwind CSS
- **文件预览**: mammoth.js (Word)、react-pdf (PDF)
- **图表**: Sigma.js + Graphology (知识图谱)

### 后端

- **框架**: NestJS 11
- **语言**: TypeScript 5
- **数据库**:
  - MongoDB (文档存储)
  - PostgreSQL + pgvector (向量存储)
  - Neo4j (知识图谱)
  - Redis (缓存)
- **认证**: JWT + Passport
- **API 文档**: Swagger
- **实时通信**: WebSocket (Socket.io)

### AI/RAG 模块

- **向量检索**: PostgreSQL pgvector
- **知识图谱**: Neo4j
- **Embedding**: 支持 OpenAI、讯飞等多种提供商
- **Rerank**: Cohere、Jina、阿里云百炼等
- **文档解析**: 支持 PDF、Word、TXT 等多种格式

## 项目结构

```
TCM-Test/
├── front/                    # 前端应用
│   ├── components/           # React 组件
│   ├── pages/                # 页面组件
│   ├── services/             # API 服务
│   ├── utils/                # 工具函数
│   ├── App.tsx               # 主应用组件
│   ├── types.ts              # TypeScript 类型定义
│   └── package.json          # 前端依赖
│
├── back/                     # 后端应用
│   ├── src/
│   │   ├── auth/             # 认证模块
│   │   ├── users/            # 用户模块
│   │   ├── vaults/           # 知识库模块
│   │   ├── files/            # 文件模块
│   │   ├── community/        # 社区模块
│   │   ├── groups/           # 社群模块
│   │   ├── interactions/     # 交互模块
│   │   ├── rag/              # RAG 模块
│   │   ├── ai/               # AI 服务
│   │   ├── events/           # WebSocket 事件
│   │   └── redis/            # Redis 缓存
│   └── package.json          # 后端依赖
│
├── .env.example              # 环境变量模板
└── README.md                 # 项目文档
```

## 快速开始

### 环境要求

- Node.js 18+
- MongoDB 5+
- PostgreSQL 14+ (带 pgvector 扩展)
- Redis 6+
- Neo4j 5+ (可选，用于知识图谱)

### 1. 克隆项目

```bash
git clone <repository-url>
cd TCM-Test
```

### 2. 配置环境变量

```bash
cp .env.example .env
# 编辑 .env 文件，配置数据库连接和 API 密钥
```

### 3. 安装依赖

```bash
# 安装后端依赖
cd back
npm install

# 安装前端依赖
cd ../front
npm install
```

### 4. 启动服务

```bash
# 启动后端服务 (在 back/ 目录下)
npm run start:dev

# 启动前端开发服务器 (在 front/ 目录下)
npm run dev
```

### 5. 访问应用

- 前端界面: <http://localhost:5173>
- 后端 API: <http://localhost:3001/api>
- API 文档: <http://localhost:3001/docs>

## 配置说明

### LLM 配置

支持多种 LLM 提供商：

- **OpenAI**: GPT-4o、GPT-4o-mini、GPT-3.5-turbo
- **Gemini**: gemini-1.5-flash、gemini-1.5-pro
- **阿里云**: kimi-k2.5、qwen-plus、qwen-turbo

### Embedding 配置

- **OpenAI**: text-embedding-3-small (1536维)、text-embedding-3-large (3072维)
- **讯飞**: xop3qwen8bembedding (768维)

### Rerank 配置

- **Cohere**: rerank-english-v3.0、rerank-multilingual-v3.0
- **Jina**: jina-reranker-v2-base-multilingual
- **阿里云**: qwen3-rerank

## API 文档

后端提供完整的 RESTful API，详见 `.trae/rules/api_data_formats.md`。主要模块包括：

- **认证模块**: 登录、注册、用户信息管理
- **知识库模块**: Vault 的 CRUD 操作、协作者管理
- **文件模块**: 文件树管理、文件内容操作
- **社区模块**: 内容发布、搜索、推荐
- **交互模块**: 点赞、收藏、评论、关注
- **社群模块**: 群组管理、消息、邀请
- **RAG 模块**: 文档上传、查询、配置管理

## 开发指南

### 前端开发

```bash
cd front
npm run dev      # 启动开发服务器
npm run build    # 构建生产版本
npm run preview  # 预览生产构建
```

### 后端开发

```bash
cd back
npm run start:dev    # 开发模式 (热重载)
npm run start:debug  # 调试模式
npm run build        # 编译 TypeScript
npm run start:prod   # 生产模式
npm run lint         # 代码检查
npm run test         # 运行测试
```

### 数据库迁移

```bash
# 后端使用 TypeORM，开发环境下自动同步
# 生产环境建议使用迁移
npm run typeorm migration:generate -- -n MigrationName
npm run typeorm migration:run
```

## 部署

### Docker 部署

项目包含 Dockerfile，支持容器化部署：

```bash
# 构建前端镜像
cd front
docker build -t tcm-obsidian-front .

# 构建后端镜像
cd ../back
docker build -t tcm-obsidian-back .
```

### 生产环境配置

1. 设置环境变量为生产模式
2. 配置反向代理 (Nginx)
3. 启用 HTTPS
4. 配置数据库连接池
5. 设置 Redis 集群
6. 配置日志收集

## 贡献指南

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 创建 Pull Request

## 许可证

本项目采用MIT许可证

## 联系方式

- 项目主页: 暂无
- 问题反馈: 563146279\@qq.com
- 邮箱: 563146279\@qq.com

## 致谢

感谢以下开源项目的支持：

- [NestJS](https://nestjs.com/)
- [React](https://react.dev/)
- [LightRAG](https://github.com/HKUDS/LightRAG)
- [Vditor](https://github.com/Vanessa219/vditor)
- [Sigma.js](https://www.sigmajs.org/)

