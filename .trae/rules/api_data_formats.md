# 后端API数据格式文档

本文档整理了所有后端API的请求参数和响应数据格式。

---

## 基础信息

- **API基础URL**: `http://localhost:3001/api`
- **认证方式**: JWT Token (通过 `Authorization: Bearer <token>` 头部传递)

---

## 1. 认证模块 (Auth)

### 1.1 用户登录
- **接口**: `POST /auth/login`
- **认证**: 需要 (Local Strategy)
- **请求参数**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| username | string | 是 | 用户邮箱或handle |
| password | string | 是 | 用户密码 |

- **响应数据**:

| 字段名 | 类型 | 说明 |
|--------|------|------|
| access_token | string | JWT访问令牌 |
| user | object | 用户信息对象 |
| user.userId | string | 用户ID |
| user.email | string | 用户邮箱 |
| user.name | string | 用户名 |
| user.handle | string | 用户handle |

### 1.2 用户注册
- **接口**: `POST /auth/register`
- **认证**: 不需要
- **请求参数**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| handle | string | 是 | 用户唯一标识 |
| name | string | 是 | 用户名 |
| email | string | 是 | 用户邮箱 |
| password | string | 是 | 用户密码 |

- **响应数据**: User对象

### 1.3 获取当前用户信息
- **接口**: `GET /auth/me`
- **认证**: 需要 (JWT)
- **响应数据**:

| 字段名 | 类型 | 说明 |
|--------|------|------|
| userId | string | 用户ID |
| email | string | 用户邮箱 |
| name | string | 用户名 |
| handle | string | 用户handle |
| bio | string | 个人简介 |

### 1.4 通过handle获取用户信息
- **接口**: `GET /auth/user/:handle`
- **认证**: 不需要
- **响应数据**:

| 字段名 | 类型 | 说明 |
|--------|------|------|
| _id | string | 用户ID |
| name | string | 用户名 |
| handle | string | 用户handle |
| bio | string | 个人简介 |

### 1.5 通过ID获取用户信息
- **接口**: `GET /auth/user/id/:userId`
- **认证**: 需要 (JWT)
- **响应数据**: 同上

### 1.6 更新个人资料
- **接口**: `PATCH /auth/profile`
- **认证**: 需要 (JWT)
- **请求参数**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| name | string | 否 | 用户名 |
| bio | string | 否 | 个人简介 |

- **响应数据**:

| 字段名 | 类型 | 说明 |
|--------|------|------|
| name | string | 更新后的用户名 |
| bio | string | 更新后的个人简介 |

---

## 2. 用户模块 (Users)

### 数据模型 (User Schema)

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| _id | string | 是 | 用户唯一ID (UUID) |
| handle | string | 是 | 用户唯一标识 |
| name | string | 是 | 用户名 |
| email | string | 是 | 用户邮箱 |
| password_hash | string | 是 | 密码哈希 |
| bio | string | 否 | 个人简介 |
| avatar_url | string | 否 | 头像URL |

---

## 3. Vault模块 (Vaults)

### 数据模型 (Vault Schema)

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| _id | string | 是 | Vault唯一ID (UUID) |
| name | string | 是 | Vault名称 |
| owner_id | string | 是 | 所有者ID |
| owner_handle | string | 否 | 所有者handle |
| is_public | boolean | 否 | 是否公开 (默认false) |
| description | string | 否 | Vault描述 |
| type | string | 否 | 类型 ('personal' \| 'community') |
| community_source_id | string | 否 | 社区来源ID |
| original_vault_id | string | 否 | 原始Vault ID |
| original_owner_handle | string | 否 | 原始所有者handle |
| original_owner_name | string | 否 | 原始所有者名称 |
| is_linked | boolean | 否 | 是否为链接Vault (默认false) |
| last_synced_at | Date | 否 | 最后同步时间 |
| collaborators | string[] | 否 | 协作者ID列表 |
| collaborator_handles | string[] | 否 | 协作者handle列表 |
| is_collaboration_enabled | boolean | 否 | 是否启用协作 (默认true) |

### 3.1 创建Vault
- **接口**: `POST /vaults`
- **认证**: 需要 (JWT)
- **请求参数**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| name | string | 是 | Vault名称 |
| description | string | 否 | Vault描述 |
| is_public | boolean | 否 | 是否公开 |
| type | string | 否 | 类型 |
| is_linked | boolean | 否 | 是否为链接Vault |
| original_vault_id | string | 否 | 原始Vault ID |

- **响应数据**: Vault对象

### 3.2 获取所有Vault
- **接口**: `GET /vaults`
- **认证**: 需要 (JWT)
- **响应数据**: Vault对象数组

### 3.3 获取单个Vault
- **接口**: `GET /vaults/:id`
- **认证**: 需要 (JWT)
- **响应数据**: Vault对象

### 3.4 更新Vault
- **接口**: `PATCH /vaults/:id`
- **认证**: 需要 (JWT)
- **请求参数**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| name | string | 否 | Vault名称 |
| description | string | 否 | Vault描述 |
| is_public | boolean | 否 | 是否公开 |

- **响应数据**: Vault对象

### 3.5 删除Vault
- **接口**: `DELETE /vaults/:id`
- **认证**: 需要 (JWT)
- **响应数据**: 删除结果

### 3.6 添加协作者
- **接口**: `POST /vaults/:id/collaborators`
- **认证**: 需要 (JWT)
- **请求参数**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| handle | string | 是 | 协作者handle |

- **响应数据**: Vault对象

### 3.7 移除协作者
- **接口**: `DELETE /vaults/:id/collaborators/:handle`
- **认证**: 需要 (JWT)
- **响应数据**: Vault对象

---

## 4. 文件模块 (Files)

### 数据模型 (FileNode Schema)

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| _id | string | 是 | 文件唯一ID (UUID) |
| vault_id | string | 是 | 所属Vault ID |
| parent_id | string | 否 | 父文件夹ID |
| name | string | 是 | 文件名 |
| type | string | 是 | 类型 ('file' \| 'folder') |
| content | string | 否 | 文件内容 (base64) |
| level | number | 否 | 层级 |
| icon_color | string | 否 | 图标颜色 |
| createdAt | Date | 是 | 创建时间 |
| updatedAt | Date | 是 | 更新时间 |

### 4.1 获取文件树
- **接口**: `GET /files/tree/:vaultId`
- **认证**: 需要 (JWT)
- **响应数据**: FileNode对象数组

### 4.2 下载文件
- **接口**: `GET /files/download/:id`
- **认证**: 需要 (JWT)
- **响应数据**: 文件流 (二进制数据)

### 4.3 获取单个文件
- **接口**: `GET /files/:id`
- **认证**: 需要 (JWT)
- **响应数据**: FileNode对象

### 4.4 创建文件/文件夹
- **接口**: `POST /files`
- **认证**: 需要 (JWT)
- **请求参数**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| vault_id | string | 是 | 所属Vault ID |
| parent_id | string | 否 | 父文件夹ID |
| name | string | 是 | 文件名 |
| type | string | 是 | 类型 ('file' \| 'folder') |
| content | string | 否 | 文件内容 (base64) |
| icon_color | string | 否 | 图标颜色 |

- **响应数据**: FileNode对象

### 4.5 更新文件
- **接口**: `PATCH /files/:id`
- **认证**: 需要 (JWT)
- **请求参数**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| name | string | 否 | 文件名 |
| content | string | 否 | 文件内容 (base64) |
| icon_color | string | 否 | 图标颜色 |

- **响应数据**: FileNode对象

### 4.6 删除文件
- **接口**: `DELETE /files/:id`
- **认证**: 需要 (JWT)
- **响应数据**: 删除结果

---

## 5. 社区模块 (Community)

### 数据模型 (Community Schema)

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| id | string | 是 | 内容唯一ID |
| author_id | string | 是 | 作者ID |
| author_name | string | 否 | 作者名称 |
| author_handle | string | 否 | 作者handle |
| title | string | 是 | 标题 |
| summary | string | 是 | 摘要 |
| long_description | string | 否 | 详细描述 |
| category | string | 是 | 分类 |
| content_type | string | 是 | 内容类型 ('blog' \| 'project' \| 'resource') |
| external_link | string | 否 | 外部链接 |
| cover_image | string | 否 | 封面图片 |
| view_count | number | 否 | 浏览数 (默认0) |
| stars_count | number | 否 | 收藏数 (默认0) |
| downloads_count | number | 否 | 下载数 (默认0) |
| content | string | 否 | 博客内容 |
| language | string | 否 | 项目语言 |
| icon | string | 否 | 项目图标 |
| icon_color | string | 否 | 图标颜色 |
| contributors_count | number | 否 | 贡献者数 (默认0) |
| citations_count | number | 否 | 引用数 (默认0) |
| license | string | 否 | 开源协议 |
| version | string | 否 | 版本号 |
| file_tree | any[] | 否 | 文件树结构 |
| original_vault_id | string | 否 | 原始Vault ID |
| createdAt | Date | 是 | 创建时间 |
| updatedAt | Date | 是 | 更新时间 |

### 5.1 创建社区内容
- **接口**: `POST /community`
- **认证**: 需要 (JWT)
- **请求参数**: Community对象
- **响应数据**: Community对象

### 5.2 获取社区首页流
- **接口**: `GET /community/feed`
- **认证**: 需要 (JWT)
- **查询参数**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| category | string | 否 | 分类过滤 |
| following | string | 否 | 是否只显示关注用户 ('true' \| 'false') |
| page | string | 否 | 页码 |
| limit | string | 否 | 每页数量 |

- **响应数据**:

| 字段名 | 类型 | 说明 |
|--------|------|------|
| items | Community[] | 内容列表 |
| total | number | 总数 |

### 5.3 获取头条
- **接口**: `GET /community/headlines`
- **认证**: 不需要
- **响应数据**: Community对象数组

### 5.4 获取开源项目列表
- **接口**: `GET /community/projects`
- **认证**: 不需要
- **响应数据**: Community对象数组

### 5.5 获取指定用户发布的内容
- **接口**: `GET /community/user/:handle`
- **认证**: 不需要
- **响应数据**: Community对象数组

### 5.6 获取博客详情
- **接口**: `GET /community/blogs/:id`
- **认证**: 不需要
- **响应数据**: Community对象 (包含反向链接)

### 5.7 获取资源列表
- **接口**: `GET /community/resources`
- **认证**: 不需要
- **响应数据**: Community对象数组

### 5.8 获取推荐博客
- **接口**: `GET /community/recommended-blogs`
- **认证**: 不需要
- **响应数据**: Community对象数组 (最多6条)

### 5.9 获取推荐资源
- **接口**: `GET /community/recommended-resources`
- **认证**: 不需要
- **响应数据**: Community对象数组 (最多6条)

### 5.10 搜索
- **接口**: `GET /community/search`
- **认证**: 不需要
- **查询参数**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| q | string | 是 | 搜索关键词 |

- **响应数据**: Community对象数组

### 5.11 获取单个社区内容
- **接口**: `GET /community/:id`
- **认证**: 不需要
- **响应数据**: Community对象

### 5.12 更新社区内容
- **接口**: `PATCH /community/:id`
- **认证**: 需要 (JWT)
- **请求参数**: Community对象 (部分字段)
- **响应数据**: Community对象

### 5.13 删除社区内容
- **接口**: `DELETE /community/:id`
- **认证**: 需要 (JWT)
- **响应数据**: 删除结果

### 5.14 验证SSL证书
- **接口**: `GET /community/verify-ssl`
- **认证**: 不需要
- **查询参数**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| url | string | 是 | 要验证的URL |

- **响应数据**:

| 字段名 | 类型 | 说明 |
|--------|------|------|
| valid | boolean | 是否有效 |
| message | string | 验证消息 |
| skippable | boolean | 是否可跳过 |
| details | object | 详细信息 |

---

## 6. 社群模块 (Groups)

### 数据模型 (Group Schema)

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| id | string | 是 | 社群唯一ID |
| name | string | 是 | 社群名称 |
| description | string | 否 | 社群描述 |
| avatar | string | 否 | 头像URL |
| creator_id | string | 是 | 创建者ID |
| creator_name | string | 否 | 创建者名称 |
| visibility | string | 否 | 可见性 ('public' \| 'private') |
| members | string[] | 否 | 成员ID列表 |
| admins | string[] | 否 | 管理员ID列表 |
| member_count | number | 否 | 成员数量 (默认0) |
| tags | string[] | 否 | 标签列表 |
| category | string | 否 | 分类 |
| post_count | number | 否 | 帖子数 (默认0) |
| is_official | boolean | 否 | 是否官方 (默认false) |
| require_approval | boolean | 否 | 是否需要审核 (默认false) |
| createdAt | Date | 是 | 创建时间 |
| updatedAt | Date | 是 | 更新时间 |

### 数据模型 (GroupMessage Schema)

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| id | string | 是 | 消息唯一ID |
| group_id | string | 是 | 所属社群ID |
| sender_id | string | 是 | 发送者ID |
| sender_name | string | 是 | 发送者名称 |
| content | string | 是 | 消息内容 |
| message_type | string | 否 | 消息类型 ('text' \| 'image' \| 'file' \| 'system') |
| attachment_url | string | 否 | 附件URL |
| reply_to | string | 否 | 回复的消息ID |
| is_deleted | boolean | 否 | 是否已删除 (默认false) |
| deleted_by | string | 否 | 删除者ID |
| deleted_at | Date | 否 | 删除时间 |
| createdAt | Date | 是 | 创建时间 |
| updatedAt | Date | 是 | 更新时间 |

### 数据模型 (GroupInvite Schema)

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| id | string | 是 | 邀请唯一ID |
| group_id | string | 是 | 社群ID |
| inviter_id | string | 是 | 邀请者ID |
| inviter_name | string | 是 | 邀请者名称 |
| invitee_id | string | 是 | 被邀请者ID |
| invitee_name | string | 是 | 被邀请者名称 |
| status | string | 否 | 状态 ('pending' \| 'accepted' \| 'expired' \| 'cancelled') |
| expires_at | Date | 否 | 过期时间 |
| createdAt | Date | 是 | 创建时间 |
| updatedAt | Date | 是 | 更新时间 |

### 数据模型 (GroupJoinRequest Schema)

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| id | string | 是 | 申请唯一ID |
| group_id | string | 是 | 社群ID |
| user_id | string | 是 | 申请者ID |
| user_name | string | 是 | 申请者名称 |
| user_handle | string | 否 | 申请者handle |
| message | string | 是 | 申请消息 |
| status | string | 否 | 状态 ('pending' \| 'approved' \| 'rejected') |
| processed_by | string | 否 | 处理者ID |
| processed_at | Date | 否 | 处理时间 |
| reject_reason | string | 否 | 拒绝原因 |
| createdAt | Date | 是 | 创建时间 |
| updatedAt | Date | 是 | 更新时间 |

### 6.1 创建社群
- **接口**: `POST /groups`
- **认证**: 需要 (JWT)
- **请求参数**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| name | string | 是 | 社群名称 |
| description | string | 否 | 社群描述 |
| visibility | string | 否 | 可见性 |
| tags | string[] | 否 | 标签 |
| category | string | 否 | 分类 |
| require_approval | boolean | 否 | 是否需要审核 |

- **响应数据**: Group对象

### 6.2 获取所有社群
- **接口**: `GET /groups`
- **认证**: 不需要
- **查询参数**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| (任意) | any | 否 | 查询条件 |

- **响应数据**: Group对象数组

### 6.3 获取热门社群
- **接口**: `GET /groups/hot`
- **认证**: 不需要
- **查询参数**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| limit | string | 否 | 数量限制 (默认10) |

- **响应数据**: Group对象数组

### 6.4 获取推荐社群
- **接口**: `GET /groups/recommended`
- **认证**: 可选
- **响应数据**: Group对象数组

### 6.5 获取我加入的社群
- **接口**: `GET /groups/my-groups`
- **认证**: 需要 (JWT)
- **响应数据**: Group对象数组

### 6.6 获取我创建的社群
- **接口**: `GET /groups/created-by-me`
- **认证**: 需要 (JWT)
- **响应数据**: Group对象数组

### 6.7 搜索社群
- **接口**: `GET /groups/search`
- **认证**: 不需要
- **查询参数**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| keyword | string | 是 | 搜索关键词 |

- **响应数据**: Group对象数组

### 6.8 获取社群详情
- **接口**: `GET /groups/:id`
- **认证**: 不需要
- **响应数据**: Group对象

### 6.9 更新社群
- **接口**: `PUT /groups/:id`
- **认证**: 需要 (JWT)
- **请求参数**: Group对象 (部分字段)
- **响应数据**: Group对象

### 6.10 删除社群
- **接口**: `DELETE /groups/:id`
- **认证**: 需要 (JWT)
- **响应数据**: 删除结果

### 6.11 加入社群
- **接口**: `POST /groups/:id/join`
- **认证**: 需要 (JWT)
- **响应数据**: 加入结果

### 6.12 退出社群
- **接口**: `POST /groups/:id/leave`
- **认证**: 需要 (JWT)
- **响应数据**: 退出结果

### 6.13 检查是否已加入
- **接口**: `GET /groups/:id/is-member`
- **认证**: 需要 (JWT)
- **响应数据**:

| 字段名 | 类型 | 说明 |
|--------|------|------|
| isMember | boolean | 是否已加入 |

### 6.14 获取社群成员列表
- **接口**: `GET /groups/:id/members`
- **认证**: 需要 (JWT)
- **响应数据**: 用户对象数组

### 6.15 获取群组消息列表
- **接口**: `GET /groups/:id/messages`
- **认证**: 需要 (JWT)
- **查询参数**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| limit | string | 否 | 数量限制 (默认50) |
| before | string | 否 | 获取此ID之前的消息 |

- **响应数据**: GroupMessage对象数组

### 6.16 发送群组消息
- **接口**: `POST /groups/:id/messages`
- **认证**: 需要 (JWT)
- **请求参数**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| content | string | 是 | 消息内容 |
| message_type | string | 否 | 消息类型 (默认'text') |
| reply_to | string | 否 | 回复的消息ID |

- **响应数据**: GroupMessage对象

### 6.17 删除/撤回群组消息
- **接口**: `DELETE /groups/:id/messages/:messageId`
- **认证**: 需要 (JWT)
- **响应数据**: 删除结果

### 6.18 提交加入申请
- **接口**: `POST /groups/:id/join-requests`
- **认证**: 需要 (JWT)
- **请求参数**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| message | string | 是 | 申请消息 |

- **响应数据**: GroupJoinRequest对象

### 6.19 获取社群的加入申请列表
- **接口**: `GET /groups/:id/join-requests`
- **认证**: 需要 (JWT)
- **响应数据**: GroupJoinRequest对象数组

### 6.20 获取我的加入申请列表
- **接口**: `GET /groups/my-join-requests`
- **认证**: 需要 (JWT)
- **响应数据**: GroupJoinRequest对象数组

### 6.21 处理加入申请
- **接口**: `POST /groups/join-requests/:requestId/process`
- **认证**: 需要 (JWT)
- **请求参数**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| approve | boolean | 是 | 是否通过 |
| rejectReason | string | 否 | 拒绝原因 |

- **响应数据**: 处理结果

### 6.22 取消我的加入申请
- **接口**: `DELETE /groups/join-requests/:requestId`
- **认证**: 需要 (JWT)
- **响应数据**: 取消结果

### 6.23 获取待处理申请数量
- **接口**: `GET /groups/:id/join-requests/pending-count`
- **认证**: 需要 (JWT)
- **响应数据**:

| 字段名 | 类型 | 说明 |
|--------|------|------|
| count | number | 待处理数量 |

### 6.24 创建邀请
- **接口**: `POST /groups/:id/invites`
- **认证**: 需要 (JWT)
- **请求参数**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| invitee_handle | string | 是 | 被邀请者handle |

- **响应数据**: GroupInvite对象

### 6.25 获取社群邀请列表
- **接口**: `GET /groups/:id/invites`
- **认证**: 需要 (JWT)
- **响应数据**: GroupInvite对象数组

### 6.26 获取我的邀请列表
- **接口**: `GET /groups/invites/my`
- **认证**: 需要 (JWT)
- **响应数据**: GroupInvite对象数组

### 6.27 接受邀请
- **接口**: `POST /groups/invites/:inviteId/accept`
- **认证**: 需要 (JWT)
- **响应数据**: 接受结果

### 6.28 拒绝邀请
- **接口**: `POST /groups/invites/:inviteId/reject`
- **认证**: 需要 (JWT)
- **响应数据**: 拒绝结果

### 6.29 取消邀请
- **接口**: `DELETE /groups/invites/:inviteId`
- **认证**: 需要 (JWT)
- **响应数据**: 取消结果

### 6.30 踢出成员
- **接口**: `DELETE /groups/:id/members/:memberId`
- **认证**: 需要 (JWT)
- **响应数据**: 踢出结果

---

## 7. 交互模块 (Interactions)

### 数据模型 (Like Schema)

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| user_id | string | 是 | 用户ID |
| target_type | string | 是 | 目标类型 ('community' \| 'comment' \| 'file' \| 'vault' \| 'blog' \| 'resource') |
| target_id | string | 是 | 目标ID |
| createdAt | Date | 是 | 创建时间 |
| updatedAt | Date | 是 | 更新时间 |

### 数据模型 (Favorite Schema)

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| user_id | string | 是 | 用户ID |
| target_type | string | 是 | 目标类型 ('community' \| 'file' \| 'vault' \| 'blog' \| 'resource') |
| target_id | string | 是 | 目标ID |
| note | string | 否 | 备注 |
| createdAt | Date | 是 | 创建时间 |
| updatedAt | Date | 是 | 更新时间 |

### 数据模型 (Repost Schema)

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| user_id | string | 是 | 用户ID |
| target_type | string | 是 | 目标类型 ('community' \| 'file' \| 'vault') |
| target_id | string | 是 | 目标ID |
| comment | string | 否 | 转发评论 |
| repost_count | number | 否 | 转发数 (默认0) |
| createdAt | Date | 是 | 创建时间 |
| updatedAt | Date | 是 | 更新时间 |

### 数据模型 (Comment Schema)

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| user_id | string | 是 | 用户ID |
| user_name | string | 是 | 用户名 |
| user_handle | string | 是 | 用户handle |
| vault_id | ObjectId | 是 | Vault ID |
| file_id | ObjectId | 是 | 文件ID |
| content | string | 是 | 评论内容 |
| likes | number | 否 | 点赞数 (默认0) |
| liked_by | string[] | 否 | 点赞用户ID列表 |
| paragraph_index | number | 是 | 段落索引 |
| parent_id | ObjectId | 否 | 父评论ID |
| replies | ObjectId[] | 否 | 回复评论ID列表 |
| createdAt | Date | 是 | 创建时间 |
| updatedAt | Date | 是 | 更新时间 |

### 数据模型 (Message Schema)

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| sender_id | string | 是 | 发送者ID |
| receiver_id | string | 是 | 接收者ID |
| content | string | 是 | 消息内容 |
| message_type | string | 否 | 消息类型 ('text' \| 'image' \| 'file' \| 'system') |
| is_read | boolean | 否 | 是否已读 (默认false) |
| read_at | Date | 否 | 阅读时间 |
| attachment_url | string | 否 | 附件URL |
| reply_to | ObjectId | 否 | 回复的消息ID |
| createdAt | Date | 是 | 创建时间 |
| updatedAt | Date | 是 | 更新时间 |

### 数据模型 (Follow Schema)

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| follower_id | string | 是 | 关注者ID |
| following_id | string | 是 | 被关注者ID |
| createdAt | Date | 是 | 创建时间 |
| updatedAt | Date | 是 | 更新时间 |

### 数据模型 (Bookmark Schema)

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| user_id | string | 是 | 用户ID |
| file_id | string | 是 | 文件ID |
| vault_id | string | 是 | Vault ID |
| file_name | string | 是 | 文件名 |
| paragraph_index | number | 否 | 段落索引 |
| createdAt | Date | 是 | 创建时间 |
| updatedAt | Date | 是 | 更新时间 |

### 数据模型 (Star Schema)

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| user_id | string | 是 | 用户ID |
| file_id | string | 是 | 文件ID |
| vault_id | string | 否 | Vault ID |

### 数据模型 (Highlight Schema)

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| _id | string | 是 | 高亮唯一ID (UUID) |
| user_id | string | 是 | 用户ID |
| file_id | string | 是 | 文件ID |
| paragraph_index | number | 否 | 段落索引 |
| text | string | 否 | 高亮文本 |
| color | string | 否 | 高亮颜色 |

### 数据模型 (Notification Schema)

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| recipient_id | string | 是 | 接收者ID |
| sender_id | string | 否 | 发送者ID |
| type | string | 是 | 通知类型 ('follow' \| 'like' \| 'comment' \| 'repost' \| 'mention' \| 'message' \| 'system' \| 'group_invite') |
| title | string | 否 | 标题 |
| content | string | 是 | 内容 |
| target_id | string | 否 | 目标ID |
| target_type | string | 否 | 目标类型 |
| is_read | boolean | 否 | 是否已读 (默认false) |
| read_at | Date | 否 | 阅读时间 |
| createdAt | Date | 是 | 创建时间 |
| updatedAt | Date | 是 | 更新时间 |

### 7.1 Star相关接口

#### 7.1.1 获取Star列表
- **接口**: `GET /user/starred`
- **认证**: 需要 (JWT)
- **响应数据**: Star对象数组

#### 7.1.2 切换Star状态
- **接口**: `POST /user/star`
- **认证**: 需要 (JWT)
- **请求参数**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| fileId | string | 是 | 文件ID |
| vaultId | string | 是 | Vault ID |

- **响应数据**: Star对象或null

### 7.2 Highlight相关接口

#### 7.2.1 获取高亮列表
- **接口**: `GET /user/highlights/:fileId`
- **认证**: 需要 (JWT)
- **响应数据**: Highlight对象数组

#### 7.2.2 添加高亮
- **接口**: `POST /user/highlights`
- **认证**: 需要 (JWT)
- **请求参数**: Highlight对象
- **响应数据**: Highlight对象

### 7.3 Bookmark相关接口

#### 7.3.1 获取书签列表
- **接口**: `GET /user/bookmarks`
- **认证**: 需要 (JWT)
- **响应数据**: Bookmark对象数组

#### 7.3.2 切换书签状态
- **接口**: `POST /user/bookmarks`
- **认证**: 需要 (JWT)
- **请求参数**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| fileId | string | 是 | 文件ID |
| vaultId | string | 是 | Vault ID |
| fileName | string | 是 | 文件名 |
| paragraphIndex | number | 否 | 段落索引 |

- **响应数据**: Bookmark对象或null

### 7.4 Comment相关接口

#### 7.4.1 获取评论列表
- **接口**: `GET /user/comments/:fileId`
- **认证**: 需要 (JWT)
- **响应数据**: Comment对象数组

#### 7.4.2 添加评论
- **接口**: `POST /user/comments`
- **认证**: 需要 (JWT)
- **请求参数**: Comment对象
- **响应数据**: Comment对象

#### 7.4.3 删除评论
- **接口**: `DELETE /user/comments/:id`
- **认证**: 需要 (JWT)
- **响应数据**: 删除结果

#### 7.4.4 切换评论点赞
- **接口**: `POST /user/comments/:id/like`
- **认证**: 需要 (JWT)
- **响应数据**: 点赞结果

#### 7.4.5 获取Vault下所有评论
- **接口**: `GET /user/comments/vault/:vaultId`
- **认证**: 需要 (JWT)
- **响应数据**: Comment对象数组

### 7.5 Follow相关接口

#### 7.5.1 关注用户
- **接口**: `POST /follow/:userId`
- **认证**: 需要 (JWT)
- **响应数据**: Follow对象

#### 7.5.2 取消关注
- **接口**: `DELETE /follow/:userId`
- **认证**: 需要 (JWT)
- **响应数据**: 取消结果

#### 7.5.3 获取粉丝列表
- **接口**: `GET /followers/:userId`
- **认证**: 需要 (JWT)
- **响应数据**: 用户对象数组

#### 7.5.4 获取关注列表
- **接口**: `GET /following/:userId`
- **认证**: 需要 (JWT)
- **响应数据**: 用户对象数组

#### 7.5.5 检查是否已关注
- **接口**: `GET /follow/status/:userId`
- **认证**: 需要 (JWT)
- **响应数据**:

| 字段名 | 类型 | 说明 |
|--------|------|------|
| isFollowing | boolean | 是否已关注 |

#### 7.5.6 获取关注统计
- **接口**: `GET /follow/counts/:userId`
- **认证**: 需要 (JWT)
- **响应数据**:

| 字段名 | 类型 | 说明 |
|--------|------|------|
| followers | number | 粉丝数 |
| following | number | 关注数 |

### 7.6 Message相关接口

#### 7.6.1 发送消息
- **接口**: `POST /messages`
- **认证**: 需要 (JWT)
- **请求参数**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| receiverId | string | 是 | 接收者ID |
| content | string | 是 | 消息内容 |
| messageType | string | 否 | 消息类型 (默认'text') |
| attachmentUrl | string | 否 | 附件URL |

- **响应数据**: Message对象

#### 7.6.2 获取消息列表
- **接口**: `GET /messages/:userId`
- **认证**: 需要 (JWT)
- **查询参数**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| limit | string | 否 | 数量限制 (默认50) |
| skip | string | 否 | 跳过数量 (默认0) |

- **响应数据**: Message对象数组

#### 7.6.3 获取会话列表
- **接口**: `GET /conversations`
- **认证**: 需要 (JWT)
- **响应数据**: 会话对象数组

#### 7.6.4 标记消息为已读
- **接口**: `PATCH /messages/:messageId/read`
- **认证**: 需要 (JWT)
- **响应数据**: Message对象

#### 7.6.5 标记所有消息为已读
- **接口**: `PATCH /messages/read-all/:userId`
- **认证**: 需要 (JWT)
- **响应数据**: 更新结果

#### 7.6.6 获取未读消息数
- **接口**: `GET /messages/unread/count`
- **认证**: 需要 (JWT)
- **响应数据**: 未读消息数

### 7.7 Like相关接口

#### 7.7.1 切换点赞状态
- **接口**: `POST /likes`
- **认证**: 需要 (JWT)
- **请求参数**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| targetType | string | 是 | 目标类型 |
| targetId | string | 是 | 目标ID |

- **响应数据**: Like对象或null

#### 7.7.2 获取点赞列表
- **接口**: `GET /likes/:targetType/:targetId`
- **认证**: 需要 (JWT)
- **响应数据**: Like对象数组

#### 7.7.3 获取用户点赞列表
- **接口**: `GET /user/likes`
- **认证**: 需要 (JWT)
- **响应数据**: Like对象数组

#### 7.7.4 获取点赞数
- **接口**: `GET /likes/count/:targetType/:targetId`
- **认证**: 需要 (JWT)
- **响应数据**: 点赞数

#### 7.7.5 检查是否已点赞
- **接口**: `GET /likes/status/:targetType/:targetId`
- **认证**: 需要 (JWT)
- **响应数据**:

| 字段名 | 类型 | 说明 |
|--------|------|------|
| hasLiked | boolean | 是否已点赞 |

### 7.8 Favorite相关接口

#### 7.8.1 切换收藏状态
- **接口**: `POST /favorites`
- **认证**: 需要 (JWT)
- **请求参数**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| targetType | string | 是 | 目标类型 |
| targetId | string | 是 | 目标ID |
| note | string | 否 | 备注 |

- **响应数据**: Favorite对象或null

#### 7.8.2 获取收藏列表
- **接口**: `GET /user/favorites`
- **认证**: 需要 (JWT)
- **响应数据**: Favorite对象数组

#### 7.8.3 按类型获取收藏
- **接口**: `GET /user/favorites/:targetType`
- **认证**: 需要 (JWT)
- **响应数据**: Favorite对象数组

#### 7.8.4 更新收藏备注
- **接口**: `PATCH /favorites/:favoriteId/note`
- **认证**: 需要 (JWT)
- **请求参数**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| note | string | 是 | 备注内容 |

- **响应数据**: Favorite对象

#### 7.8.5 检查是否已收藏
- **接口**: `GET /favorites/status/:targetType/:targetId`
- **认证**: 需要 (JWT)
- **响应数据**:

| 字段名 | 类型 | 说明 |
|--------|------|------|
| hasFavorited | boolean | 是否已收藏 |

#### 7.8.6 获取收藏数
- **接口**: `GET /favorites/count/:targetType/:targetId`
- **认证**: 需要 (JWT)
- **响应数据**: 收藏数

### 7.9 Repost相关接口

#### 7.9.1 创建转发
- **接口**: `POST /reposts`
- **认证**: 需要 (JWT)
- **请求参数**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| targetType | string | 是 | 目标类型 |
| targetId | string | 是 | 目标ID |
| comment | string | 否 | 转发评论 |

- **响应数据**: Repost对象

#### 7.9.2 删除转发
- **接口**: `DELETE /reposts/:targetType/:targetId`
- **认证**: 需要 (JWT)
- **响应数据**: 删除结果

#### 7.9.3 获取转发列表
- **接口**: `GET /reposts/:targetType/:targetId`
- **认证**: 需要 (JWT)
- **响应数据**: Repost对象数组

#### 7.9.4 获取用户转发列表
- **接口**: `GET /user/reposts`
- **认证**: 需要 (JWT)
- **响应数据**: Repost对象数组

#### 7.9.5 获取转发数
- **接口**: `GET /reposts/count/:targetType/:targetId`
- **认证**: 需要 (JWT)
- **响应数据**: 转发数

#### 7.9.6 检查是否已转发
- **接口**: `GET /reposts/status/:targetType/:targetId`
- **认证**: 需要 (JWT)
- **响应数据**:

| 字段名 | 类型 | 说明 |
|--------|------|------|
| hasReposted | boolean | 是否已转发 |

### 7.10 Notification相关接口

#### 7.10.1 获取通知列表
- **接口**: `GET /notifications`
- **认证**: 需要 (JWT)
- **查询参数**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| limit | string | 否 | 数量限制 (默认20) |
| skip | string | 否 | 跳过数量 (默认0) |

- **响应数据**: Notification对象数组

#### 7.10.2 获取未读通知
- **接口**: `GET /notifications/unread`
- **认证**: 需要 (JWT)
- **响应数据**: Notification对象数组

#### 7.10.3 标记通知为已读
- **接口**: `PATCH /notifications/:notificationId/read`
- **认证**: 需要 (JWT)
- **响应数据**: Notification对象

#### 7.10.4 标记所有通知为已读
- **接口**: `PATCH /notifications/read-all`
- **认证**: 需要 (JWT)
- **响应数据**: 更新结果

#### 7.10.5 获取未读通知数
- **接口**: `GET /notifications/unread/count`
- **认证**: 需要 (JWT)
- **响应数据**: 未读通知数

#### 7.10.6 删除通知
- **接口**: `DELETE /notifications/:notificationId`
- **认证**: 需要 (JWT)
- **响应数据**: 删除结果

#### 7.10.7 删除所有通知
- **接口**: `DELETE /notifications`
- **认证**: 需要 (JWT)
- **响应数据**:

| 字段名 | 类型 | 说明 |
|--------|------|------|
| deletedCount | number | 删除数量 |

---

## 8. AI模块 (AI)

### 8.1 AI聊天
- **接口**: `POST /ai/chat`
- **认证**: 需要 (JWT)
- **请求参数**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| (任意) | any | 否 | 聊天参数 |

- **响应数据**: AI响应内容

---

## 9. Redis模块 (Redis)

### 9.1 健康检查
- **接口**: `GET /redis/health`
- **认证**: 不需要
- **响应数据**:

| 字段名 | 类型 | 说明 |
|--------|------|------|
| status | string | 状态 |
| message | string | 状态消息 |
| connected | boolean | 是否已连接 |
| timestamp | string | 时间戳 |

### 9.2 设置缓存值
- **接口**: `POST /redis/set/:key`
- **认证**: 不需要
- **请求参数**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| value | any | 是 | 缓存值 |
| ttl | number | 否 | 过期时间(秒) |

- **响应数据**:

| 字段名 | 类型 | 说明 |
|--------|------|------|
| success | boolean | 是否成功 |
| message | string | 结果消息 |

### 9.3 获取缓存值
- **接口**: `GET /redis/get/:key`
- **认证**: 不需要
- **响应数据**:

| 字段名 | 类型 | 说明 |
|--------|------|------|
| key | string | 键名 |
| value | any | 缓存值 |
| exists | boolean | 是否存在 |

### 9.4 删除缓存值
- **接口**: `DELETE /redis/del/:key`
- **认证**: 不需要
- **响应数据**:

| 字段名 | 类型 | 说明 |
|--------|------|------|
| success | boolean | 是否成功 |
| message | string | 结果消息 |

### 9.5 增加计数器
- **接口**: `POST /redis/increment/:key`
- **认证**: 不需要
- **请求参数**:

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| amount | number | 否 | 增加数量 (默认1) |

- **响应数据**:

| 字段名 | 类型 | 说明 |
|--------|------|------|
| success | boolean | 是否成功 |
| key | string | 键名 |
| value | number | 当前值 |

### 9.6 检查key是否存在
- **接口**: `GET /redis/exists/:key`
- **认证**: 不需要
- **响应数据**:

| 字段名 | 类型 | 说明 |
|--------|------|------|
| key | string | 键名 |
| exists | boolean | 是否存在 |

### 9.7 清空所有缓存
- **接口**: `DELETE /redis/clear`
- **认证**: 不需要
- **响应数据**:

| 字段名 | 类型 | 说明 |
|--------|------|------|
| success | boolean | 是否成功 |
| message | string | 结果消息 |

---

## 10. WebSocket事件 (Events)

### 10.1 加入Vault房间
- **事件**: `joinVault`
- **发送数据**: vaultId (string)
- **接收数据**:

| 字段名 | 类型 | 说明 |
|--------|------|------|
| event | string | 'joinedVault' |
| data | string | vaultId |

### 10.2 离开Vault房间
- **事件**: `leaveVault`
- **发送数据**: vaultId (string)
- **接收数据**:

| 字段名 | 类型 | 说明 |
|--------|------|------|
| event | string | 'leftVault' |
| data | string | vaultId |

### 10.3 协作信号
- **事件**: `collaborationSignal`
- **发送数据**:

| 字段名 | 类型 | 说明 |
|--------|------|------|
| vaultId | string | Vault ID |
| payload | any | 信号数据 |

- **接收数据**:

| 字段名 | 类型 | 说明 |
|--------|------|------|
| clientId | string | 客户端ID |
| (其他) | any | payload中的数据 |

---

## 11. 文件存储模块 (FileStorage)

### 数据模型 (StoredFile Entity)

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| id | string | 是 | 文件唯一ID (UUID) |
| original_name | string | 是 | 原始文件名 |
| mime_type | string | 是 | MIME类型 |
| size | number | 是 | 文件大小 |
| content_base64 | string | 是 | 文件内容 (base64) |
| owner_id | string | 是 | 所有者ID |
| community_content_id | string | 否 | 社区内容ID |
| created_at | Date | 是 | 创建时间 |
| updated_at | Date | 是 | 更新时间 |

---

## 12. 学习链接模块 (LearningLink)

### 数据模型 (LearningLink Schema)

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| id | string | 是 | 链接唯一ID (UUID) |
| title | string | 是 | 标题 |
| summary | string | 是 | 摘要 |
| external_link | string | 是 | 外部链接地址 |
| cover_image | string | 否 | 封面图片URL |
| author_id | string | 是 | 作者ID |
| author_name | string | 否 | 作者名称 |
| author_handle | string | 否 | 作者handle |
| category | string | 否 | 分类 (默认'学习资源') |
| tags | string[] | 否 | 标签列表 |
| view_count | number | 否 | 浏览数 (默认0) |
| stars_count | number | 否 | 收藏数 (默认0) |
| createdAt | Date | 是 | 创建时间 |
| updatedAt | Date | 是 | 更新时间 |

---

## 枚举类型定义

### ContentType (内容类型)
```typescript
enum ContentType {
  BLOG = 'blog',       // 博客
  PROJECT = 'project', // 项目
  RESOURCE = 'resource' // 资源
}
```

### FileType (文件类型)
```typescript
enum FileType {
  FILE = 'file',     // 文件
  FOLDER = 'folder'  // 文件夹
}
```

### GroupVisibility (社群可见性)
```typescript
enum GroupVisibility {
  PUBLIC = 'public',   // 公开
  PRIVATE = 'private'  // 私有
}
```

### GroupMessageType (群组消息类型)
```typescript
enum GroupMessageType {
  TEXT = 'text',     // 文本
  IMAGE = 'image',   // 图片
  FILE = 'file',     // 文件
  SYSTEM = 'system'  // 系统消息
}
```

### InviteStatus (邀请状态)
```typescript
enum InviteStatus {
  PENDING = 'pending',     // 待处理
  ACCEPTED = 'accepted',   // 已接受
  EXPIRED = 'expired',     // 已过期
  CANCELLED = 'cancelled'  // 已取消
}
```

### JoinRequestStatus (加入申请状态)
```typescript
enum JoinRequestStatus {
  PENDING = 'pending',   // 待处理
  APPROVED = 'approved', // 已通过
  REJECTED = 'rejected'  // 已拒绝
}
```

### LikeTargetType (点赞目标类型)
```typescript
enum LikeTargetType {
  COMMUNITY = 'community', // 社区内容
  COMMENT = 'comment',     // 评论
  FILE = 'file',           // 文件
  VAULT = 'vault',         // Vault
  BLOG = 'blog',           // 博客
  RESOURCE = 'resource'    // 资源
}
```

### FavoriteTargetType (收藏目标类型)
```typescript
enum FavoriteTargetType {
  COMMUNITY = 'community', // 社区内容
  FILE = 'file',           // 文件
  VAULT = 'vault',         // Vault
  BLOG = 'blog',           // 博客
  RESOURCE = 'resource'    // 资源
}
```

### RepostTargetType (转发目标类型)
```typescript
enum RepostTargetType {
  COMMUNITY = 'community', // 社区内容
  FILE = 'file',           // 文件
  VAULT = 'vault'          // Vault
}
```

### MessageType (消息类型)
```typescript
enum MessageType {
  TEXT = 'text',     // 文本
  IMAGE = 'image',   // 图片
  FILE = 'file',     // 文件
  SYSTEM = 'system'  // 系统消息
}
```

### NotificationType (通知类型)
```typescript
enum NotificationType {
  FOLLOW = 'follow',           // 关注
  LIKE = 'like',               // 点赞
  COMMENT = 'comment',         // 评论
  REPOST = 'repost',           // 转发
  MENTION = 'mention',         // 提及
  MESSAGE = 'message',         // 消息
  SYSTEM = 'system',           // 系统
  GROUP_INVITE = 'group_invite' // 群组邀请
}
```

---

*文档生成时间: 2026-02-06*
