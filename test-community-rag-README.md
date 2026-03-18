# 社区资源 RAG 内容读取测试脚本

此脚本用于测试后端是否能正确读取社区资源中的文档内容，并验证 LightRAG 构建时是否正确使用文档内容。

## 前置条件

1. 后端服务已启动并运行在 `http://localhost:3001`
2. Node.js 版本 >= 18（支持 fetch API）

## 使用方法

### 1. 基本测试（不包含社区内容）

```bash
node test-community-rag.js
```

这将运行以下测试：
- 健康检查
- 文档上传和处理
- 向量搜索
- 知识图谱提取

### 2. 测试特定社区内容

```bash
# Windows
set TEST_CONTENT_ID=your-content-id-here
node test-community-rag.js

# Linux/Mac
TEST_CONTENT_ID=your-content-id-here node test-community-rag.js
```

### 3. 修改脚本中的默认配置

编辑 `test-community-rag.js` 文件，修改 `TEST_CONFIG`：

```javascript
const TEST_CONFIG = {
  contentId: 'your-content-id-here',  // 替换为实际的社区内容 ID
  userId: 'test-user-id',
};
```

## 测试内容说明

### 测试 1: 健康检查
- 端点: `GET /rag-test/health`
- 目的: 验证后端服务是否正常运行

### 测试 2: 读取社区内容
- 端点: `GET /rag-test/community/content/:contentId`
- 目的: 验证是否能正确读取社区资源中的文件内容
- 输出信息:
  - 标题、类型
  - 是否有直接内容/长描述/摘要
  - 文件树数量
  - 成功读取的文件数
  - 总内容长度
  - 内容预览

### 测试 3: 测试 RAG 文档创建流程
- 端点: `POST /rag-test/community/create-rag-doc`
- 目的: 模拟完整的 RAG 文档创建流程
- 验证内容是否足够用于 RAG 构建

### 测试 4: 文档上传和处理
- 端点: `POST /rag-test/upload`
- 目的: 测试文档上传、分块、embedding 生成

### 测试 5: 向量搜索
- 端点: `POST /rag-test/search`
- 目的: 测试向量搜索功能

### 测试 6: 知识图谱提取
- 端点: `POST /rag-test/graph/extract`
- 目的: 测试从文本中提取实体和关系

## 预期输出

### 正常情况

```
========================================
测试 2: 读取社区内容
内容 ID: xxxxxx
========================================
✅ 成功读取社区内容
  - 标题: 测试资源
  - 类型: resource
  - 有直接内容: false
  - 有长描述: true
  - 有摘要: true
  - 文件树数量: 3
  - 找到文件数: 3
  - 成功读取文件数: 3
  - 文件详情: [ { name: 'file1.txt', size: 1234 }, ... ]
  - 总内容长度: 5678 字符

✅ 内容读取正常，可用于 LightRAG 构建
```

### 警告情况（需要修复）

```
⚠️ 警告: 未读取到任何实质内容，RAG 构建可能只使用元数据！
```

这种情况表示：
- 社区内容没有 `content` 字段
- 没有 `long_description` 或 `summary`
- 文件树中的文件没有 `stored_file_id`
- 文件存储服务中没有找到对应的文件

## 故障排除

### 1. 连接被拒绝

```
❌ 健康检查失败: fetch failed
```

**解决方案**: 确保后端服务已启动

```bash
cd back
npm run start:dev
```

### 2. 内容 ID 不存在

```
❌ 读取失败: Community content not found for id: xxx
```

**解决方案**: 
- 检查内容 ID 是否正确
- 确认该内容存在于数据库中

### 3. 未读取到文件内容

```
⚠️ 警告: 未读取到任何实质内容，RAG 构建可能只使用元数据！
```

**可能原因**:
- 文件存储服务中没有对应的文件
- `stored_file_id` 字段为空或无效
- 文件内容为空

**检查方法**:
1. 查看 MongoDB 中的社区内容文档
2. 检查 `file_tree` 字段是否有 `stored_file_id`
3. 检查 PostgreSQL 的 `stored_files` 表中是否有对应记录

## API 端点列表

| 端点 | 方法 | 描述 |
|------|------|------|
| `/rag-test/health` | GET | 健康检查 |
| `/rag-test/community/content/:contentId` | GET | 读取社区内容 |
| `/rag-test/community/create-rag-doc` | POST | 测试 RAG 文档创建 |
| `/rag-test/upload` | POST | 上传测试文档 |
| `/rag-test/search` | POST | 向量搜索 |
| `/rag-test/graph/extract` | POST | 知识图谱提取 |

## 相关代码文件

- `back/src/rag/rag.service.ts` - RAG 服务，包含 `createRagDocumentFromCommunity` 方法
- `back/src/rag/rag-test.controller.ts` - 测试控制器
- `back/src/file-storage/file-storage.service.ts` - 文件存储服务
